function loadScript(src, fallbackSrc) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = function() {
      if (fallbackSrc) {
        console.warn('CDN failed: ' + src + ', trying fallback...');
        var fb = document.createElement('script');
        fb.src = fallbackSrc;
        fb.onload = resolve;
        fb.onerror = reject;
        document.head.appendChild(fb);
      } else { reject(new Error('Failed to load: ' + src)); }
    };
    document.head.appendChild(s);
  });
}
// qrcode.js 立即加载（结果页渲染需要）
loadScript(
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
).then(function(){ console.log('qrcode.js loaded'); })
 .catch(function(e){ console.error('qrcode.js load failed:', e); });

// html2canvas 懒加载：点击生成海报时才加载（~500KB）
var _html2canvasLoading = null;
function ensureHtml2Canvas() {
  if (typeof html2canvas !== 'undefined') return Promise.resolve();
  if (_html2canvasLoading) return _html2canvasLoading;
  _html2canvasLoading = loadScript(
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
  ).then(function(){ console.log('html2canvas lazy-loaded'); });
  return _html2canvasLoading;
}

/* ==========================================
 * 事件追踪框架（已接入CloudBase数据库）
 * ========================================== */
let _cbDb = null;
function trackEvent(category, action, label, value) {
  try {
    console.log('[Track]', category, action, label || '', value || '');
    if (_cbDb) {
      _cbDb.collection('events').add({
        c: category,
        a: action,
        l: label || '',
        v: value || 0,
        pet: 'cat',
        t: new Date(),
        ts: Date.now()
      });
    }
  } catch(e) { /* 静默忽略追踪错误 */ }
}
/* ==========================================
 * CloudBase 初始化（埋点数据写入云数据库）
 * ========================================== */
(async function initCloudBase() {
  try {
    const app = cloudbase.init({
      env: 'mengchong-dev-6g4qar062ad266bc'
    });
    const auth = app.auth({ persistence: 'local' });
    await auth.signInAnonymously();
    _cbDb = app.database();
    console.log('[CloudBase] 初始化成功，匿名登录完成');
    // 初始化完成后再记录 page_view，确保事件不丢失
    trackEvent('funnel', 'page_view', document.title);
  } catch(e) {
    console.warn('[CloudBase] 初始化失败，埋点将仅打印到控制台', e);
  }
})();

/* 调试用：URL带 ?reset=1 时自动清除所有本地缓存（模拟新用户） */
if (new URLSearchParams(window.location.search).get('reset') === '1') {
  localStorage.clear();
  window.history.replaceState({}, '', window.location.pathname);
  console.log('[Debug] localStorage 已清除，模拟新用户');
}

/* ==========================================
 * 全局状态
 * ========================================== */
let idx = -1;                                       // 当前题目索引（-1=未开始）
let score = {E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};   // 维度分数
let answerHistory = [];                              // 答题历史，用于返回上一题
let finalType = "";                                  // 计算出的 MBTI 类型
let isTransitioning = false;                         // 防止切题动画期间重复点击
let hasShownWecomModal = false;                      // 确保企微弹窗只弹一次
let avatarUploaded = false;                           // 本次会话是否已上传头像
const AVATAR_KEY = "cat_mbti_avatar";
const DEFAULT_AVATAR = "touxiang.png.jpg";
const UNLOCK_KEY = "cat_mbti_unlocked";              // 解锁状态存储键
let unlockCountdownTimer = null;                     // 倒计时定时器

// 16种类型专属主题色（轻量点缀：类型大字+头像边框）
const typeColors = {
  ENFP:'#FF8C42', ENFJ:'#FF6B8A', ENTP:'#5CB8FF', ENTJ:'#C94040',
  ESFP:'#FFB627', ESFJ:'#FF7EB3', ESTP:'#FF6542', ESTJ:'#4A7C59',
  INFP:'#B088F9', INFJ:'#6C8EBF', INTP:'#5B9A8B', INTJ:'#4A5568',
  ISFP:'#E88DB4', ISFJ:'#F4A460', ISTP:'#708090', ISTJ:'#8B7355',
};

// SBTI 梗代号映射（MBTI→宠物SBTI代号）
const typeCodeMap = {
  ENFP:'HYPE', ENFJ:'CARE', ENTP:'BOOM', ENTJ:'BOSS',
  ESFP:'WILD', ESFJ:'GLUE', ESTP:'YOLO', ESTJ:'COP!',
  INFP:'EMO!', INFJ:'HEAL', INTP:'ZONE', INTJ:'COLD',
  ISFP:'DIVA', ISFJ:'SIMP', ISTP:'CHILL', ISTJ:'TICK'
};

// 20题：每个维度5题（猫咪向）— 暴论化改写，维度顺序打散

const questions = [
  // Q1 — E/I
  { id:"E1", dim:"EI", q:"有不明人类闯入领地，TA的安保反应：", A:"大摇大摆走出来验货——「让我看看是什么档次的人类配进我家」", B:"消失得比你年终奖还快，等威胁解除才从次元裂缝里探出头", scoreA:{E:1}, scoreB:{I:1}},
  // Q2 — S/N
  { id:"S1", dim:"SN", q:"你买了个新纸箱放地上，TA的反应：", A:"绕着闻一圈，伸爪试探，确认安全才钻进去——标准验收流程", B:"看了一秒直接跳进去——管它是啥先占了再说", scoreA:{S:1}, scoreB:{N:1}},
  // Q3 — T/F
  {id:"T1",dim:"TF",q:"它又跳上餐桌了。你深呼吸三次，用你此生最有威慑力的语气说了一个字——「下！」结果：",A:"它看了你一眼，慢悠悠跳下去了——但你一转身，它已经原地复活",B:"它耳朵往后一压，眼神比你甩了它还委屈——然后你开始道歉了",scoreA:{T:1},scoreB:{F:1}},
  // Q4 — J/P
  { id:"J1", dim:"JP", q:"TA的生物钟精确程度：", A:"比闹钟还准——到点就跳上床催你起来/蹲饭碗前审判你", B:"完全看心情——有时四点发疯，有时睡到中午", scoreA:{J:1}, scoreB:{P:1}},
  // Q5 — E/I
  { id:"E2", dim:"EI", q:"你在忙自己的事，TA的态度：", A:"过来踩你键盘蹭你手——「注意力必须在我身上，谢谢」", B:"在旁边自己待着——「你在就行，但别碰我」", scoreA:{E:1}, scoreB:{I:1}},
  // Q6 — S/N
  { id:"S2", dim:"SN", q:"你拿逗猫棒逗它玩，TA的战斗风格：", A:"眼睛锁定目标，精确计算距离，一扑一个准——狙击手型", B:"跳起来扑空了也不在意，中途突然去追自己尾巴——抽象型", scoreA:{S:1}, scoreB:{N:1}},
  // Q7 — T/F
  { id:"T2", dim:"TF", q:"要让它配合剪指甲这种酷刑，哪招更管用？", A:"快准狠+事后给零食——它认交易", B:"先抱着哄半天+温柔说话——它吃情绪价值", scoreA:{T:1}, scoreB:{F:1}},
  // Q8 — J/P
  { id:"J2", dim:"JP", q:"如果TA的生活拍成纪录片，画风更像：", A:"《猫生作息表》——精确到分钟的每日流程，强迫症看了都鼓掌", B:"《荒野求生·家居版》——没人知道下一秒它出现在哪，包括它自己", scoreA:{J:1}, scoreB:{P:1}},
  // Q9 — E/I
  { id:"E3", dim:"EI", q:"你终于拖着社畜的躯壳回来了，TA的反应：", A:"已经蹲门口等了，喵喵叫着绕脚转——「你怎么才回来？」", B:"从某个角落抬头看你一眼——「哦，你回来了。然后呢？」", scoreA:{E:1}, scoreB:{I:1}},
  // Q10 — S/N
  { id:"S3", dim:"SN", q:"你觉得TA对家里变化的感知能力：", A:"精密雷达——你挪了一本书它都要盯着看半天", B:"佛系随缘——家具搬了位置也无所谓，反正最后都归它", scoreA:{S:1}, scoreB:{N:1}},
  // Q11 — T/F
  {id:"T3",dim:"TF",q:"你被生活暴打了一顿，瘫在沙发上怀疑人生。TA扫了你一眼：",A:"路过看了你一眼确认你没死，然后去吃饭了——「你自己会好的」",B:"跳上沙发靠着你坐下，用头蹭蹭你的手——反常得让你更想哭了",scoreA:{T:1},scoreB:{F:1}},
  // Q12 — J/P
  {id:"J3",dim:"JP",q:"凌晨三点，TA突然开始猫咪跑酷。你躺在床上想：",A:"又到了它每天固定的发疯时间，精确得像定了闹钟",B:"完全随机——也许一粒灰尘飘过就触发了它的战斗本能",scoreA:{J:1},scoreB:{P:1}},
  // Q13 — E/I
  {id:"E4",dim:"EI",q:"此题由你家猫主子亲自出题：「关于社交这件事，本喵的态度是」",A:"多多益善！每个路过的人类都值得被我翻牌子",B:"请提前三个工作日预约，临时来访恕不接待",scoreA:{E:1},scoreB:{I:1}},
  // Q14 — S/N
  { id:"S4", dim:"SN", q:"TA盯着窗外发呆的时候，脑子里大概在想：", A:"认真分析——那只鸟几点来的、从哪飞的，一切尽在掌握", B:"天马行空——也许在幻想自己是翱翔天际的猎手吧", scoreA:{S:1}, scoreB:{N:1}},
  // Q15 — T/F
  { id:"T4", dim:"TF", q:"另一只猫/宠物抢了TA的窝，TA的应对策略：", A:"一巴掌呼过去——「我的地盘我做主，有意见？」", B:"委屈地看看你喵了一声——「你是我的靠山，你管管啊」", scoreA:{T:1}, scoreB:{F:1}},
  // Q16 — J/P
  { id:"J4", dim:"JP", q:"你换了猫粮品牌/喂食时间，TA的接受度：", A:"明显不适应，拒绝进食或反复闻了又走——「谁批准你改的？」", B:"无所谓有得吃就行——适应力惊人", scoreA:{J:1}, scoreB:{P:1}},
  // Q17 — E/I
  { id:"E5", dim:"EI", q:"TA平时在家的领地分布：", A:"你在哪它在哪，从客厅跟到厨房跟到卧室——24小时监控系统", B:"有自己的固定据点，你想找它可以，它不会主动找你——「有事请预约」", scoreA:{E:1}, scoreB:{I:1}},
  // Q18 — S/N
  {id:"S5",dim:"SN",q:"你在它面前放了一个从没见过的东西。三、二、一：",A:"先闻，再拍，再咬——标准三步鉴定流程，一步都不能少",B:"一掌拍飞。不需要鉴定，先干掉再说",scoreA:{S:1},scoreB:{N:1}},
  // Q19 — T/F
  { id:"T5", dim:"TF", q:"它打碎了你的杯子被当场抓获，审讯现场的表现：", A:"面不改色继续舔爪子——「嗯是我干的，怎么了？它凭什么站在桌子边缘挑衅我」", B:"缩起身子耳朵压平，可怜巴巴看你——提前认罪求情", scoreA:{T:1}, scoreB:{F:1}},
  // Q20 — J/P
  { id:"J5", dim:"JP", q:"玩逗猫棒时，TA的战斗风格：", A:"蹲伏→瞄准→起跳，每次套路差不多——程序化执行", B:"追两下突然停住舔毛，下一秒又疯了——完全随机", scoreA:{J:1}, scoreB:{P:1}}
];

// 16型结果库（中文名+金句+建议+标签）——猫咪版
const results = {
  "ENFP": { name:"好奇心炸弹", rarity:8, line:"世界这么大，每个角落都得亲自查一遍——等下那是啥？！",
    desc:"恭喜你，你家这位不是猫，是一颗装了好奇心引信的定时炸弹。世界在它眼里没有「已探索区域」，只有「还没被我拍过的东西」。一个塑料袋能让它研究半小时，一只苍蝇能让它上演一出谍战片。你以为它在发呆？不，它在用它那颗比你WiFi信号还不稳定的脑子计算下一个入侵目标。最可怕的是——它的好奇心没有冷却时间。",
    tags:["社交达喵","好奇心爆棚","一秒入戏"],
    monologue:"我知道你嫌我一天到晚上蹿下跳，但你不懂——我是在巡视我的王国！对了，那个塑料袋刚才是不是动了一下？等我去看看。你说我三分钟前才看过？那是三分钟前的塑料袋，现在的塑料袋是全新的情报对象。你别走，我马上回来……大概吧。也可能不回来了，取决于路上有没有更重要的事件发生。",
    tips:["每天保证两次高质量互动（逗猫棒+藏食游戏）","定期换新玩具保持新鲜感，不然它会去开发你的纸巾盒","高处空间一定要有，它需要登高望远"],
    bubbles:["多动症","戏精","显眼包","ADHD","整活","e人","上头"],
    profile:{
      traits:["注意力存续时间约等于金鱼——0.3秒换一个目标","体内装了永动机，唯一的关机方式是断电式昏睡","情绪外放到邻居都知道它今天开不开心"],
      behaviors:["快递还没拆完它已经坐进纸箱开始宣布主权了","玩具存活时间90秒，之后沦为被遗忘的前任","听到塑料袋响直接进入战斗状态，不管是不是垃圾袋"],
      innerVsOuter:{inner:["那边有动静！管它是啥先冲了再说！","新人类！快来见识本喵的社交天赋！","好困…但万一错过什么大事件呢？再撑一会"],outer:["一头扎进塑料袋里疯狂打滚把自己缠住了","飞扑到客人肩上把人吓得尖叫","打着哈欠还死撑着追逗猫棒，眼神已经对不上焦了"]}
    },
    guide:{
      relationship:["每天给它'探索时间'，让它闻新东西、看新视频；好奇心被满足了就不搞破坏","给予正面反馈，它靠认可驱动"],
      feeding:["少量多餐，配合漏食球增加进食趣味；直接放饭碗太无聊","注意体重管理，兴奋状态下别喂零食"],
      toys:["逗猫棒、弹力球、纸袋纸箱是标配；三天换一批才够","益智类玩具轮换使用保持新鲜感","藏食游戏消耗脑力"],
      emotion:["它的'疯跑'不是发疯，是在释放能量","冷落它会让它找别的目标（比如你的沙发）"]
    }},
  "ENFJ": { name:"操心喵", rarity:5, line:"你还没回来，它就已经蹲门口了——它比你妈还了解你的行程",
    desc:"不是猫，是一台装了情绪识别芯片的毛绒监控器。你叹口气它瞳孔放大，你皱个眉它耳朵转向，你哭出来它直接启动应急贴贴程序。操心范围覆盖全家所有碳基生物，包括不需要它操心的那些。你以为它在巡逻？不，它在查岗。你以为它在蹭你？不，它在做心理评估。这辈子能把「多管闲事」做到如此感人的，也就它了。",
    tags:["情绪雷达","治愈系","操心命"],
    monologue:"你以为我在撒娇？不好意思，我在监控你的精神状态。你叹了口气？问题已被我的雷达捕获。你说你没事？你的微表情告诉我你在说谎。好了别装了，把腿伸过来让我趴一会儿——这是治疗，不是撒娇。我不会说话，但我的体温比你那些「在吗」好使多了。",
    tips:["多用语言和抚摸给予回应，它需要'被认可'","家里有争吵时注意安抚它，它会内化负面情绪","社交安排以熟悉的人为主，它不喜欢太混乱的场面"],
    bubbles:["老妈子","碎碎念","共情怪","操碎心","雷达精","护崽狂"],
    profile:{
      traits:["自带情绪扫描仪，你叹口气它就启动应急预案","全家每个房间每天巡逻三遍，比物业还敬业","操心范围覆盖全家——包括你根本不需要它操心的事"],
      behaviors:["你一哭它就跳上来贴脸输出安慰，不管你是不是在看催泪视频","家里关门声大了立刻跑去现场排查，脸上写满「出什么事了」","每天早上依次巡房查岗，确认所有人类都还活着才安心吃饭"],
      innerVsOuter:{inner:["你叹气了！警报！需要立刻启动贴贴程序！","那个关门声不正常！必须去确认！万一有人受伤了呢！","今天被夸了嘿嘿嘿嘿可以开心到明天"],outer:["默默跳上沙发贴着你坐下，咕噜声开到最大档","冲到门口探头探脑一脸严肃地排查情况","被夸之后咕噜声大到隔壁邻居都能当白噪音"]}
    },
    guide:{
      relationship:["多跟它说话，它听得懂你的语气；给它一个'陪伴岗位'（比如固定坐你旁边的位置）","多夸奖多抚摸，它需要持续的正面反馈"],
      feeding:["定时定量，它喜欢有规律的生活；吃饭时可以轻声跟它说话","可以用喂食时间做简单互动"],
      toys:["喜欢和你一起玩的互动玩具；独自玩的兴趣不大","适合柔软的陪伴型玩偶"],
      emotion:["避免在它面前激烈争吵；分离时间不宜太长，它会焦虑","给它稳定的日常节奏就是最好的安全感"]
    }},
  "ENTP": { name:"柜顶拆迁办", rarity:6, line:"你说桌上的杯子不能碰？那它试试推到什么程度你才崩溃",
    desc:"不是猫，是一个披着毛皮的实验物理学家兼边界测试工程师。它人生的终极课题就是：这个东西推到什么程度你会崩溃？杯子是第一组实验对象，花瓶是对照组，你的精神状态是因变量。你说「不行」，它听成了「挑战已接受」。你把东西收起来，它把这理解为「难度升级」。整个家就是它的实验室，而你是唯一的被试。",
    tags:["高智商","爱搞事","试探边界"],
    monologue:"你说我在搞破坏？冤枉，我在做控制变量实验。这个杯子推到桌沿2厘米你会大叫，1.5厘米你只皱眉——这是非常有价值的行为学数据。你说不能碰？这个信息让实验更有趣了。你把杯子收走？很好，说明你的崩溃阈值在下降，我需要换个实验对象。那个花瓶看起来不错。",
    tips:["必须给足够的脑力挑战：益智喂食器、藏食游戏","家里易碎品收好，不是它坏，是它太聪明","训练不能太重复，变着花样来它才配合"],
    bubbles:["高智商犯罪","杠精","拆家","边界测试","作妖","反骨","整活王"],
    profile:{
      traits:["智商高到让你怀疑它在暗中策划什么阴谋","把「你说不行那我偏要」刻进了DNA","无聊五分钟就能给你制造一个月的维修账单"],
      behaviors:["把桌上的东西一个个推到边缘然后盯着你的脸——在观察你的崩溃阈值","自学了开柜门开抽屉，你家的隐私约等于零","训练配合三遍后开始自由发挥——它觉得原版太无聊需要改良"],
      innerVsOuter:{inner:["这杯子推到几厘米的时候铲屎官会尖叫呢？实验开始","你说不行？很好，这个信息让我更感兴趣了","新玩具？给我三分钟——不，两分钟就够了"],outer:["优雅地一爪把杯子推下桌，全程面无表情","被赶下桌三秒后从另一侧跳上来，眼神写满挑衅","叼着从益智玩具里暴力拆解出来的零食在你面前炫耀"]}
    },
    guide:{
      relationship:["给它足够的脑力挑战，无聊是一切问题的根源","跟它玩要有策略，别太容易让它赢"],
      feeding:["用漏食球、藏食拼图增加进食难度","直接放碗里太没挑战了"],
      toys:["益智玩具越难越好","定期更换，它破解速度比你买新的快","需要持续升级难度"],
      emotion:["它推东西不是在报复你，是在'做实验'","给够刺激，问题行为自然消失"]
    }},
  "ENTJ": { name:"霸道总裁喵", rarity:4, line:"凌晨五点谁叫谁起床，看看就知道谁才是主人",
    desc:"不是猫，是一个把家当上市公司经营的毛绒CEO。凌晨五点半跳你脸上不是闹你，是晨会。它巡视领地不是在散步，是在做季度审查。你以为你是主人？看看谁定的作息表、谁批准的喂食时间、谁决定沙发归属权。它不发脾气，它发的是KPI不达标通知书。在它的管理哲学里，你不是铲屎官，你是还没转正的试用期员工。",
    tags:["强势","掌控","领地意识"],
    monologue:"我不是霸道，我只是比你更懂效率。五点半叫你起床是科学作息，七点喂饭是营养管理，你偶尔的反抗我理解为「员工情绪波动」已记录在案。你说这是你的家？翻翻房产证上写的谁的名字——精神层面的房产证。不服可以申诉，申诉窗口在我心情好的时候开放，大概一年两次。",
    tips:["尊重它的领地意识，别随意改变家里布局","多猫家庭注意资源分配（食盆、猫砂盆要够）","给它'管理权'——比如固定的巡逻路线和高处观察点"],
    bubbles:["PUA","控制狂","职场霸总","甲方","压迫感","老板","power"],
    profile:{
      traits:["把全家当自己的公司来管理，你只是打工的","领地意识强到连空气流动方向都要审批","想要的东西三秒内必须到手，否则启动施压模式"],
      behaviors:["凌晨五点半准时跳你脸上——你的起床闹钟从此失业","占据家里最高点俯瞰一切，活像个审视下属的CEO","新来的猫/人必须通过它的面试，不合格直接劝退"],
      innerVsOuter:{inner:["五点半了，醒。不是在商量，是在通知。","这个新来的得先搞清楚这里谁说了算","嗯…其实我也需要你…但这种话说出来有损威严"],outer:["坐在你枕头上拿爪子反复拍你的脸直到你睁眼","堵在走廊中间不让新猫通过，一脸「想过去？先递简历」","巡逻完毕回到你身边趴下——下班了可以放松一下了"]}
    },
    guide:{
      relationship:["给它'管理权'——猫爬架最高层、固定巡逻路线","别跟它硬刚，用食物引导"],
      feeding:["固定时间固定地点，它喜欢可预测的秩序","多猫家庭分开喂"],
      toys:["需要有'目标'的游戏——捕猎模拟、追逐赛","无目的的逗弄它不感兴趣","策略型互动最合适"],
      emotion:["尊重它的领地意识","来新猫时给足隔离适应期"]
    }},
  "ESFP": { name:"蹦迪喵", rarity:9, line:"有你有小鱼干有逗猫棒，喵生巅峰不过如此",
    desc:"不是猫，是一颗出厂自带蹦迪模式的毛球。快乐是它的默认设置，悲伤功能压根没装，忧郁那个app它连下载都没下载过。逗猫棒一晃它能嗨到灵魂出窍，塑料袋一响它百米冲刺赶到现场。它用生命诠释了什么叫「活在当下」——因为它的脑子里确实没有「明天」这个概念。你是它的快乐源泉，小鱼干是它的精神支柱，这两样齐了，喵生已经巅峰了。",
    tags:["外向","爱玩","快乐至上"],
    monologue:"生活就应该是开心的啊！你回来了，开心！有小鱼干，开心！逗猫棒在动，超级开心！你看我翻了个肚皮——你也开心了对不对？对不对！你今天看起来不太开心？没关系让我表演一个从柜顶飞下来的绝技——啊摔了，但是没关系因为我还是很开心！",
    tips:["每天至少两次互动游戏，它是快乐的永动机","注意控制体重——它太爱吃零食了","兴奋过头时帮它'刹车'，比如用食物引导它安静下来"],
    bubbles:["嗨皮","没心没肺","干饭王","社牛","蹦迪","快乐废猫","躁起来"],
    profile:{
      traits:["快乐是出厂设置，悲伤功能压根没装","对所有人类无差别友善，社交底线约等于零","活在当下的终极贯彻者——脑子里没有「明天」这个概念"],
      behaviors:["逗猫棒的塑料袋一响，三个房间外百米冲刺赶到现场","翻肚皮是它的社交货币，对谁都通用，毫无门槛","玩到舌头伸出来喘粗气还不肯停——快乐的代价是心肺功能"],
      innerVsOuter:{inner:["逗猫棒逗猫棒逗猫棒啊啊啊啊啊！！！","新人类！新朋友！让我表演一个翻肚皮！","好累好喘…但万一你不陪我玩了呢…再来亿轮！"],outer:["从柜顶飞身扑下来差点把自己摔散架","初次见面的客人还没坐下它已经翻肚皮了","喘得像拉风箱还在追逗猫棒，眼神涣散但意志坚定"]}
    },
    guide:{
      relationship:["用互动游戏满足它旺盛的玩耍欲","每天给'安静时间'让它学会休息"],
      feeding:["严格控制零食量，它会用卖萌让你加餐","定时定量是关键"],
      toys:["逗猫棒、弹力球、纸团都是好选择","它不挑，有得玩就行","追逐型玩具最合适"],
      emotion:["兴奋过头时用零食引导安静下来","社交过后给独处时间恢复"]
    }},
  "ESFJ": { name:"猫皮膏药", rarity:10, line:"你关厕所门的那一秒，它的世界崩塌了",
    desc:"不是猫，是一块拥有自主意识的生物膏药。追踪精度比GPS还高，延迟比5G还低，你从客厅移动到厨房的3.2秒内它已经完成了跟踪部署。你关厕所门的那一刻，它的世界观崩塌了——「为什么要把我隔绝在你的生命之外？」你出门上班，它趴在门口等，你鞋上的味道是它撑过这八小时的唯一精神支柱。黏人不是它的缺点，是它的全部人格。",
    tags:["黏人","分离焦虑","贴身雷达"],
    monologue:"你出门的时候我没叫，不是因为不在意，是因为怕你心疼。但门关上以后我就趴在玄关了，你鞋子上的味道是我这八小时的全部精神寄托。你上厕所关门？你知道那扇门对我来说意味着什么吗？意味着你可能在里面消失了。别嫌我黏，你选择养我的时候这个条款就生效了，终身不可撤销。",
    tips:["给稳定的生活节奏和固定仪式感","分离训练要循序渐进，从短时间开始","出门前不要大张旗鼓告别，低调离开反而更好"],
    bubbles:["跟踪狂","分离焦虑","恋爱脑","黏黏怪","工具猫","全天候","不放手"],
    profile:{
      traits:["全天候人形GPS，追踪精度误差不超过0.5米","分离焦虑指数爆表——你关厕所门的那秒它的世界末日就来了","把全家人的行踪安排得明明白白，少一个都不行"],
      behaviors:["你去厨房它跟到厨房，你上厕所它蹲门口——隐私是什么？不存在的","你出门它趴门口等，你一回来它冲过来喵喵叫像失散多年","全家人必须都到齐它才肯去睡觉——自封的人口普查员"],
      innerVsOuter:{inner:["你要出门了…我装作不在意…骗谁呢心都碎成渣了","门锁在响！是你吗是你吗是你吗是你吗！！！","人到齐了，好的，今晚不用写遗书了"],outer:["默默趴在门口用无辜的大眼睛注视你穿鞋的全过程","门一开就冲过来嚎叫着绕脚转三圈才肯停","确认全家到齐后终于瘫到自己窝里，如释重负"]}
    },
    guide:{
      relationship:["给稳定的日常仪式感（固定喂食、固定睡觉位置）","分离训练循序渐进，从短时间开始"],
      feeding:["定时定量最重要，打乱节奏它会焦虑","可以用喂食仪式增强安全感"],
      toys:["陪伴型互动为主——抚摸、一起看窗外就好","不需要太复杂的玩具","互动类玩具增进感情"],
      emotion:["出门前低调，回家后先冷静再互动","给它你的旧衣服放窝里增加安全感"]
    }},
  "ESTP": { name:"飞檐走壁侠", rarity:7, line:"那个柜子顶它还没去过——等下，已经去了",
    desc:"不是猫，是一个把你家当跑酷训练场的极限运动员。风险评估能力为零，先跳了再想落点的问题，落点不对就再跳一次，反正据说有九条命。冰箱顶是一号打卡点，书架是二号，空调是隐藏关卡。你以为它在发疯？它在刷新个人纪录。你以为安装了防护网就安全了？那只是给它增加了新的攀爬路线。在它眼里，牛顿发明万有引力纯属多管闲事。",
    tags:["冒险王","行动派","爬酷高手"],
    monologue:"你问我为什么要跳到冰箱上面？因为它在那里啊。你问我为什么从冰箱跳到书架？因为我能啊。你问我为什么书架上的书全掉了？因为那是它们的问题不是我的问题。猫生就是要不断挑战极限，你那个「下来」的指令我听到了，但我的身体不受大脑控制——不对，是大脑选择性忽略了你。",
    tips:["家里必须有足够的垂直空间（猫爬架、跳台）","危险区域要做好防护（高窗、阳台）","充足的运动量是它情绪稳定的关键"],
    bubbles:["莽就完了","跑酷","命硬","不怕死","肾上腺素","全损","冲冲冲"],
    profile:{
      traits:["风险评估能力为零——先跳了再想落点的问题","胆大到让你怀疑它有九条命而且已经用了七条","到哪都自来熟，仿佛全世界都是它的游乐场"],
      behaviors:["家里所有高处必须打卡——冰箱顶柜子顶空调上，一个都不能少","听到任何异响第一个冲过去，像被按了出警按钮","第一次去陌生地方零恐惧，你还在门口犹豫它已经巡视完了"],
      innerVsOuter:{inner:["那个架子看着不太稳…管它呢先跳了再说！摔了算意外","有动静！出击！分析是什么的事等冲过去再说！","这个水龙头凭什么能出水？让本喵来解构一下"],outer:["一个起跳上了书架，书哗啦啦全掉了，它面不改色","像导弹一样射向阳台窗台开始军事侦查","拨弄水龙头把自己浇了一身，甩甩头继续拨弄"]}
    },
    guide:{
      relationship:["给足垂直空间（猫爬架必备）","阳台和高窗做好安全防护"],
      feeding:["运动量大需要充足营养","可以把食物放在不同高度增加探索乐趣"],
      toys:["追逐型玩具最合适——弹力球、激光笔","适合敏捷训练","高处跳台是最好的游乐场"],
      emotion:["限制活动空间会让它焦躁","给足运动量，拆家行为自然减少"]
    }},
  "ESTJ": { name:"巡逻队长", rarity:9, line:"说好七点吃饭就七点，迟到一分钟它就用眼神杀你",
    desc:"不是猫，是一个把家庭生活过成军事化管理的毛绒纪检委书记。七点吃饭是铁律，七点零一分就是违纪，它的眼神能把你钉在耻辱柱上。巡逻路线固定到厘米级，任何偏离日常的行为都会被记录在案。你换了个沙发套，它绕着闻了二十分钟才勉强批准。在它的世界观里，规矩不是用来打破的，打破规矩的人才是用来打破的。",
    tags:["守时","讲规矩","秩序维护者"],
    monologue:"七点零一分了你怎么还不喂饭？你知道你迟到了吗？我的日程表精确到秒——七点吃饭，七点半巡逻，八点占窗台，八点半洗脸。每一项都环环相扣，你一个环节掉链子我整天的KPI就废了。你上次也迟到了，我记着呢。再有下次，我就用凌晨四点叫醒你作为惩罚。别觉得我在开玩笑。",
    tips:["固定作息是它最大的安全感——喂食、玩耍时间尽量别变","环境变化要给适应期，别突然大改","它的'盯着你看'不是控制，是在提醒你'该做某事了'"],
    bubbles:["强迫症","打卡","KPI","考勤","死板","卷王","准时"],
    profile:{
      traits:["把生活过成了KPI考核表——每项精确到分钟","堪称家庭秩序维护者，迟到一分钟就用眼神给你记过","对规则的执着程度让强迫症患者都自愧不如"],
      behaviors:["每天固定时间催饭固定时间巡逻固定时间睡觉，比上班打卡还准","你偏离了日常流程它就用死亡凝视纠正你——无声的压力比闹钟还有效","新猫来了它第一件事是制定「家规」——违者后果自负"],
      innerVsOuter:{inner:["七点零二分了。你迟到了。要我提醒你几次？","规矩就是规矩。今天破例明天就无法无天了","日程安排好了就不要改。改了我整个猫生都乱了"],outer:["坐在饭碗前直勾勾盯着你，眼神能在墙上钻孔","新来的猫踩了它的窝，一爪子扇过去——这叫新员工培训","你换了喂食时间它在旧时间点焦躁踱步像个等开会的中层"]}
    },
    guide:{
      relationship:["尽量保持日常节奏稳定","如果要改变什么，循序渐进"],
      feeding:["固定时间固定地点固定分量——这是它的人生信条","打乱节奏它会焦虑"],
      toys:["规则明确的互动游戏——定点、追逐、寻回","它讨厌没规律的逗弄","有章法的玩耍最合适"],
      emotion:["突然的环境变化会让它焦虑","搬家/换家具前给足过渡期"]
    }},
  "INFP": { name:"emo喵", rarity:6, line:"全世界只要你就够了，其他人？不熟谢谢再见",
    desc:"不是猫，是一个住在毛皮里的文艺青年兼抑郁诗人。内心戏多到能拍八季连续剧外加两部电影，但嘴上一个字不说。社交圈小到只有你一个VIP名额，其他人类全是路过的NPC。你换了个沐浴露它能emo三天，你晚回家十五分钟它已经在脑子里写好了告别信。窗台是它的文学创作基地，发呆是它的精神修行，而你的旧T恤是它的安全毯和精神药物。",
    tags:["敏感","慢热","深情"],
    monologue:"你不在的时候我趴在你的枕头上，不是因为枕头舒服，是因为上面有你的味道。你就是我全部的安全感，你知道吗？外面世界太吵了，那些陌生人类太多了，我只要你就好。你今天晚回来了十五分钟，我已经把最坏的情况想了一遍。你别走，走的话……把你的臭袜子留下，让我闻着撑过去。",
    tips:["给它一个专属安全角（窝/半封闭空间），那是它的充电站","社交不要勉强，让它按自己的节奏来","训练要温柔，大声说话会吓到它"],
    bubbles:["玻璃心","i人","社恐","emo","恋爱脑","文艺青年","破防"],
    profile:{
      traits:["内心戏多到能拍八集连续剧——你根本不知道它在想什么","社交圈小到只有你一个名额，其他人全是NPC","敏感程度堪比地震仪——你换了个沐浴露它都能emo三天"],
      behaviors:["一下午坐在窗台上望着窗外发呆——你以为它在写诗其实它在emo","陌生人来了秒消失，但你喊它名字它会从缝隙里露出半只眼睛偷看","安安静静趴你旁边不说话——但你起身它就紧张"],
      innerVsOuter:{inner:["你的枕头上有你的味道…闻着就不那么害怕了","有陌生人！世界末日！启动隐身模式！你在哪！","你今天回来晚了十五分钟…我已经想好了告别辞"],outer:["你出门后叼着你的臭袜子回窝抱着睡——别问为什么","客人门铃还没按完它已经蒸发了，消失速度打破物理定律","你回来后假装淡定地走过来蹭了蹭你脚踝——其实已经等崩溃了"]}
    },
    guide:{
      relationship:["减少强制社交，让它有安全的退路","给它你的旧衣服放窝里"],
      feeding:["安静环境下进食，别在旁边大声说话","可以手喂增进信任"],
      toys:["轻柔的逗猫棒、安静的嗅闻玩具","不适合太激烈的追逐游戏","柔软的陪伴型玩偶最合适"],
      emotion:["大声呵斥会让它很久才恢复","它的胆小不是缺陷，尊重它的节奏"]
    }},
  "INFJ": { name:"月光读心师", rarity:3, line:"它什么都不说，安安静静待你旁边，然后你就好了",
    desc:"不是猫，是一台伪装成毛球的高精度心理分析仪。它什么都不说，但什么都知道——你今天笑了几次、叹了几口气、刷手机的时候表情变了几回，全在它的数据库里。社交距离精确到厘米级，不黏不远，刚好让你觉得被爱着又不觉得窒息。平时看着佛系得像个禅修大师，但你难过的时候它会默默挪过来，用一种「我什么都懂但我不说破」的眼神看你。治愈你不靠说话，靠存在本身。",
    tags:["洞察力","安静治愈","有分寸"],
    monologue:"我不是不爱热闹，我只是觉得热闹是浪费彼此的时间。你看书我趴着，你发呆我也趴着——这叫高质量陪伴，你们人类花钱上课才学得会的东西我天生就懂。你难过的时候我会多靠你近一点，但我不会大惊小怪地蹭你——那太没格调了。我只是安静地在这里，让你知道：你不是一个人。这就够了。多余的话有失身份。",
    tips:["固定的作息和环境给它最大的安全感","社交以熟人为主，慢慢扩圈","它的沉默不是冷漠，是在用自己的方式表达爱"],
    bubbles:["读心术","闷骚","通灵","暗中观察","老阴阳","腹黑","装淡定"],
    profile:{
      traits:["自带读心术外挂——你的情绪波动它比你自己先知道","社交距离精确到厘米——不黏不远刚好让你觉得被爱着","平时看着佛系，关键时刻靠谱得让你想哭"],
      behaviors:["永远在你附近一米内但绝不打扰你——像个高级监控摄像头","你心情不好它就默默挪过来多蹭你两下——精准到像读了你的日记","对陌生人维持表面礼貌但眼神写着「你谁啊别过来」"],
      innerVsOuter:{inner:["你难过了。别装了我都看出来了。我过去。","我不说话不代表没在爱你——我每秒都在暗中观察你","你今天笑了三次比昨天多一次。嗯数据记录完毕。"],outer:["默默跳上沙发贴着你趴下，全程零台词","你加班时它安静趴在桌角看着你——眼神像在说「又加班？」","你笑的时候它微微眯眼回应——冷漠外表下的最大让步"]}
    },
    guide:{
      relationship:["给它固定的'陪伴位'（你桌旁、沙发旁）","不需要特意逗它，在一起就好"],
      feeding:["安静规律的喂食环境","不喜欢被打扰进食"],
      toys:["轻柔的互动就好——羽毛逗猫棒慢慢晃","不适合太嘈杂的玩法","安静型嗅闻玩具"],
      emotion:["社交以熟人为主","它的沉默是在用它的方式爱你"]
    }},
  "INTP": { name:"纸箱哲学家", rarity:5, line:"盯着墙发呆半小时不是傻，是在思考喵生的意义",
    desc:"不是猫，是一个穿着毛皮大衣的学术宅。能对着一滴水研究半小时存在主义，对着墙壁思考二十分钟量子力学——至少它认为自己在思考量子力学。你的指令不在它的处理队列里，它的CPU只运行自己的课题。你以为它在发呆？它在做田野调查。你以为它不理你？它在进行高优先级思考，你的呼唤属于低优先级中断请求，已被挂起。养它和养盆栽的唯一区别是——盆栽不会偶尔过来蹭你一下。",
    tags:["独立","研究型","自有节奏"],
    monologue:"我对着那个水龙头研究了半小时不是发呆，我在分析液体从固体管道中喷射的物理原理。你们人类不懂科学的魅力，算了不解释了——你的知识储备理解不了我的课题。你叫我名字了？嗯，收到，排队吧，前面还有三个研究任务。你走开别挡我视线，你的存在影响了实验环境的变量控制。等我忙完了……可能会去蹭你一下。可能。",
    tips:["给它独处的空间和时间，别强行互动","益智喂食器和新鲜事物能满足它的研究欲","它不理你不代表不爱你，只是在'工作'"],
    bubbles:["自闭","学术猫","发呆","不理人","活在自己世界","研究僧","宅"],
    profile:{
      traits:["自带学术光环——能对着一滴水思考半小时人生意义","独立到让你怀疑自己只是个自动投喂机器","学习能力爆表但完全按自己心情来——你的指令不在处理范围内"],
      behaviors:["对着水龙头/墙壁/空气盯了二十分钟不动——你以为它死机了其实它在做课题","自己跟自己玩得很开心，你的存在感约等于空气净化器","叫它名字要叫三遍以上，第四遍它才慢悠悠抬头给你一个「什么事」的眼神"],
      innerVsOuter:{inner:["这个水龙头的出水原理到底是什么…让我再观察6000秒","你在叫我？嗯…排队吧等我把这个课题做完","你坐旁边可以但闭嘴——我在进行高级思考活动"],outer:["对着水龙头看了整整二十分钟，表情严肃得像在写论文","叫了四遍才懒洋洋抬头看你一眼然后又低下头了","你安静坐旁边不说话时它反而凑过来蹭你——研究员也需要充电"]}
    },
    guide:{
      relationship:["尊重它的独处时间","给新鲜事物激发好奇心——新纸箱、新材质的玩具"],
      feeding:["漏食球和藏食拼图比直接喂更合适","让吃饭也变成'研究'"],
      toys:["新奇的东西比贵的东西好使","需要定期换新","益智玩具、解谜类是首选"],
      emotion:["它不回应你不代表不爱你，给足自主空间","你安静陪着时它反而会主动靠近"]
    }},
  "INTJ": { name:"高冷审判官", rarity:4, line:"看似不需要你，其实你走哪它的视线跟到哪",
    desc:"不是猫，是一尊有体温的冰雕。冷到你怀疑它是不是真的属于哺乳动物，但半夜偷偷跳上床蹭你又暴露了它的哺乳动物本质。看什么都带审视的滤镜，在它眼里全世界都在接受评估，而大多数人类的评估结果是「不合格」。零食放面前它也不屑一顾——不是不饿，是吃相太急有损格调。你热情叫它名字它只抬一下眼皮——但耳朵的转向已经出卖了一切。它爱你，但这种话说出来有损它的霸权威严。",
    tags:["冷静","策略家","审视一切"],
    monologue:"我不是不理你，只是觉得大惊小怪很没必要，有损我们双方的格调。你热情喊我名字？嗯，收到了。别期待更多回应，这个眼神已经是我的最高礼遇了。但你晚上睡着以后我会跳上床确认你还在——确认了，安心了，跳走了。这件事你不需要知道，知道了也别声张。我的形象管理不允许出现「其实很在乎你」这种低级人设崩塌。",
    tips:["规则明确、边界清晰，别朝令夕改","社交别催它，给它选择权","猫爬架高处是它的'王座'，必须保留"],
    bubbles:["高冷","装逼","面瘫","心机猫","傲娇","审判","生人勿近"],
    profile:{
      traits:["冷到你怀疑它是不是真的是哺乳动物——但其实暗中在乎你到骨子里","看什么都是审视的眼神——在它眼里全世界都在接受评估","自控力强到零食放面前都不屑一顾——丢什么也不能丢面子"],
      behaviors:["新环境先占据高处观察全局，确认安全系数达标才优雅地下来","你回家热情叫它它只抬眼皮看一下又闭上——但耳朵出卖了它在听","陌生人想摸它？一个侧身闪开——「你配吗」写在脸上"],
      innerVsOuter:{inner:["不是不理你。是你大惊小怪的样子实在有损我的格调","你睡了吧？让我去确认一下…别误会，纯属例行检查","一切尽在掌握。只是懒得跟你们说而已。"],outer:["你热情叫它名字它只是缓缓看了你一眼然后移开视线","半夜偷偷跳上床蹭了你一下又立刻跳走——不能被发现","客人伸手想摸它被一个教科书级侧身闪开，场面一度尴尬"]}
    },
    guide:{
      relationship:["规则明确别变来变去","别强行抱它，等它主动来找你"],
      feeding:["不贪食但对品质有要求","固定时间放好即可，别盯着它吃"],
      toys:["高难度益智玩具才配得上它","策略型藏食游戏","不喜欢无意义的重复"],
      emotion:["它的高冷是性格不是不爱你","半夜来蹭你就是它最大的表白"]
    }},
  "ISFP": { name:"躺平贵族", rarity:7, line:"阳光、软垫、你的腿——完美三件套缺一不可",
    desc:"不是猫，是一位投胎到猫科动物界的退休贵族。对舒适度的要求堪比米其林暗访评审员——垫子硬度不达标直接差评，阳光角度偏了五度就要换位置。它每天的核心工作就是在全家试遍所有角落，选出今日「最佳躺点」，选址流程比你买房还严谨。你摸它的手法不对它直接扭头走人，摸对了才赏你一声咕噜——这声咕噜就是它给你的五星好评，且随时可撤回。",
    tags:["温柔","享受型","审美在线"],
    monologue:"阳光刚好照到那块垫子上，温度也刚刚好，风速也在可接受范围内。这就是完美的午后。你要是能过来摸摸我的下巴那就更完美了——注意，是下巴，不是肚子，摸肚子的权限你还没解锁。对了你新换的那个猫砂质感不行，颗粒太粗，脚感差评。改回去，这不是建议，是通知。",
    tips:["环境舒适度是第一要务——垫子要软、窝要暖、光线要好","训练用鼓励替代压力，温柔引导","尊重它的挑剔，那是在告诉你它的需求"],
    bubbles:["矫情","公主病","挑剔","躺尸","颜控","摆烂","精致穷"],
    profile:{
      traits:["对舒适度的要求堪比五星级酒店差评师——垫子不够软直接差评","慢热到你以为它不喜欢你——其实只是入职审核期比较长","挑剔程度让你怀疑上辈子是不是贵族投胎的"],
      behaviors:["每天在家试遍所有角落才能选出今天的「最佳躺点」——选址比买房还慎重","阳光好的时候往窗边一趴就是一下午——行为艺术级别的躺平","你摸它的手法不对它直接扭开——对了才赏你一声咕噜，服务评分制度"],
      innerVsOuter:{inner:["这个垫子硬度不达标。差评。换下一个。","阳光角度完美温度适宜——所有人别动保持现状","你摸的位置偏了0.5厘米…往左…对了…可以给你打个及格分"],outer:["试了四个位置才选定今天的「最佳躺点」，比选酒店还认真","在窗边阳光里趴了一整个下午，换了三个姿势都是优雅的","你摸右边它嫌弃地扭开，摸左边才勉强开启咕噜模式"]}
    },
    guide:{
      relationship:["环境舒适是一切的基础——温度、垫子、噪音都会影响它","训练用鼓励替代压力，温柔引导"],
      feeding:["对食物品质挑剔，可能需要换几种才找到最爱","进食环境要安静"],
      toys:["轻柔的逗猫棒、羽毛玩具","节奏慢一点，别太激烈","柔软的垫子和玩偶"],
      emotion:["它的挑剔是在表达需求","给足舒适感，它会回报你最温柔的咕噜"]
    }},
  "ISFJ": { name:"安静舔喵", rarity:10, line:"不争不抢，你出门它守门口，你回来它假装在睡觉",
    desc:"不是猫，是一个把「默默爱你」写进基因的隐形守护者。安静到你经常忘了家里还有只猫，但低头一看它就在你脚边。不争不抢到被别的猫欺负了都默默让开，卑微得让人心疼。你出门它趴在门口等，你回来它假装在睡觉——演技烂到尾巴尖还在颤。它对你的依恋深入骨髓但死也不说，闷骚界天花板级别的存在。你可能是它全世界唯一的VIP，但它决不会让你知道这件事。",
    tags:["安静","忠诚","岁月静好"],
    monologue:"你关门出去的时候我没叫，因为怕你心疼。但门关上以后我就趴在玄关了，盯着门缝下面那条光线等你的影子出现。你的脚步声是我每天最期待的声音，我能从二十种脚步声里精准识别你的——别问我怎么做到的，爱会让耳朵进化。你回来了？我假装在睡觉。你走过来了？我假装刚醒。你摸我了？好吧……让我蹭你一下……就一下。",
    tips:["规律的陪伴是它最大的安全感","分离训练要循序渐进，别一下子离开太久","多做轻柔的肢体接触——抚摸、梳毛就是最好的互动"],
    bubbles:["老实猫","舔狗","卑微","讨好型","透明人","心软","隐形"],
    profile:{
      traits:["安静地爱你到你完全忽略了它的存在——猫界透明人","不争不抢到被别的猫欺负了也只会默默让开——卑微到让人心疼","对你的依恋深到骨子里但死也不说——闷骚界天花板"],
      behaviors:["永远在你附近但绝不出声——你在书桌它在脚边当隐形守护者","你生病了它就安安静静趴在你旁边一整天——连呼噜声都调小了","多猫家庭里被抢了窝抢了食都默默退让——你不注意都发现不了"],
      innerVsOuter:{inner:["你要出门了…没关系…我装作不在意…其实很在意","你回来了！！！太好了太好了！！！…我冷静一下假装淡定","别的猫抢了我的窝…算了让给它吧…反正角落也挺好的"],outer:["安静蹲在门口看你穿鞋，尾巴微微颤抖出卖了内心","慢慢走过来蹭了蹭你脚踝然后假装路过——演技拉垮","默默让出窝去角落趴下，眼神写着委屈但嘴上不说"]}
    },
    guide:{
      relationship:["规律的陪伴节奏——每天固定抚摸时间","多猫家庭要给它专属空间"],
      feeding:["定时定量配合温柔语气","多猫家庭确保它能安心吃到饭"],
      toys:["轻柔互动为主——抚摸、梳毛、轻轻晃逗猫棒","不需要太复杂","陪伴型玩偶给它安全感"],
      emotion:["分离训练循序渐进","给它你的旧衣物增加安全感"]
    }},
  "ISTP": { name:"摆烂喵", rarity:5, line:"独来独往，偶尔蹭你一下就算今天施舍你的爱了",
    desc:"不是猫，是一个把「省电模式」当人生哲学的毛绒佛系大师。一天24小时有23小时在某个角落瘫着，剩下1小时平均分配给吃饭、上厕所和偶尔蹭你一下。情绪波动范围约等于零——你以为它佛系？它只是懒得有情绪。你叫它名字它最多给你一个抬眼皮的面子，指望它跑过来？你想多了。但路过你的时候突然蹭你一下又头也不回地走了——恭喜，今日爱的配额已发放完毕。",
    tags:["独立","冷静","旁观者"],
    monologue:"我知道你觉得我不够热情。但热情这种东西太耗电了，我的电池容量只够维持基本运转。你淋着雨回来那天我看了你一眼，心里想的是「回来就好」，然后我又趴下了——因为确认你没事了就够了，多余的话说出来显得矫情。你非要跟我互动？可以，给你三十秒。好了时间到了，我该回去瘫着了。别追过来，那是我的私人空间。",
    tips:["给足独处空间，别一直抱着不放","它不黏你不代表不爱你——半夜偷偷靠过来就是证据","社交少而精，不要安排太多刺激"],
    bubbles:["死宅","已读不回","爱答不理","佛系","冷暴力","省电模式","独狼"],
    profile:{
      traits:["独立到让你怀疑养它和养盆栽的区别——但盆栽不会偶尔蹭你","情绪波动范围约等于零——你以为它佛系其实它只是懒得有情绪","什么都看在眼里但就是不说——猫界已读不回冠军"],
      behaviors:["一天24小时有23小时在角落趴着——剩下1小时分配给吃饭和上厕所","你叫它名字它最多给你一个抬眼皮的面子——过来？想多了","路过你时突然蹭你一下然后头也不回走了——今日爱的配额已用完"],
      innerVsOuter:{inner:["我自己待着挺好的你别过来打扰我的清净","你回来了…嗯…知道了。然后呢？","其实偶尔被你摸一下…还行吧…别跟别人说"],outer:["在角落趴了一整天，换了三个姿势但位置没变","你进门热情打招呼它抬头看了一眼又闭眼了——已读不回","路过你时突然蹭了一下然后继续走——你还没反应过来它已经消失了"]}
    },
    guide:{
      relationship:["给足空间，别追着它抱","它主动来找你的时候好好回应"],
      feeding:["安静独立的进食空间","不喜欢被盯着吃饭"],
      toys:["独自能玩的玩具最合适——球、弹簧鼠","互动时保持'冷酷'风格，别太热情","不需要太多社交互动"],
      emotion:["它的'独处'是充电不是冷战","偶尔的蹭蹭就是它最大的告白"]
    }},
  "ISTJ": { name:"准时闹钟喵", rarity:8, line:"每天固定时间发疯固定时间吃饭，比你的作息还规律",
    desc:"不是猫，是一个穿着毛皮制服的瑞士钟表。生活规律到像个写好剧本的NPC——每天同一时间吃饭、同一时间巡逻、同一时间发呆、同一时间跳你脸上叫你起床，误差不超过两分钟。你拿它当活闹钟用了三年，精确度吊打你买的所有电子设备。它的人生信条是：日子可以重复，但不可以打乱。你敢改它的作息，它就敢在凌晨三点给你上一课什么叫「规矩不可废」。情绪稳定到你有时想戳它一下看看是不是真猫。",
    tags:["规律达人","守序","省心"],
    monologue:"早上六点半准时叫你起床不是因为我饿了——好吧也是因为饿了。但更重要的是昨天六点半喂的，前天六点半喂的，大前天也是。既然形成了规矩，就一天也不能差。你今天想睡懒觉？不好意思我的系统不支持这个功能。你敢变作息我就敢在凌晨四点发动攻势。别觉得我死板，我只是在维护这个家最后的秩序。没有我，你的人生早就散架了。",
    tips:["固定规则+固定节奏是它的人生信条","环境变化要给充足的适应期","它的'催促'不是烦人，是在执行它认定的规则"],
    bubbles:["NPC","循环播放","复读机","机器猫","流水线","活闹钟","无聊到极致"],
    profile:{
      traits:["生活规律到像个写好程序的NPC——每天重复同样的剧本","对秩序的执念让你怀疑它前世是个钟表匠","情绪稳定到你有时想戳它一下看看有没有反应"],
      behaviors:["每天同一时间跳上床拍你脸叫你起床，误差不超过两分钟——比闹钟敬业","固定位置吃饭固定位置睡觉固定位置发呆——动线图画出来是完美重叠的","绝不搞突袭不搞破坏不跑酷——行为可预测到让你怀疑它是不是机器猫"],
      innerVsOuter:{inner:["六点半了。该起了。不是在商量。这是写进日程表的。","今天的流程跟昨天一样。很好。世界运转正常。","日子虽然重复…但你每天都在…这就够了"],outer:["准时跳上床拍你的脸——闹钟看了都说专业","吃完饭去窗台趴着，跟昨天前天大前天一模一样","每天晚上准时走到你身边趴下——你甚至能用它来校准手表"]}
    },
    guide:{
      relationship:["保持日常节奏稳定","改变任何事情都要循序渐进"],
      feeding:["固定时间固定地点固定分量——它的终极安全感来源","打乱节奏会让它焦虑"],
      toys:["规律性的互动——每天固定时间玩一次就好","不需要花哨","简单重复的游戏它最喜欢"],
      emotion:["突然的变化是它最大的压力源","搬家/换环境给足过渡时间"]
    }}
};

// 二维码指向首页（而非当前测试页），让养猫/养狗的人都能进入，最大化裂变
const getTestLink = () => location.origin + '/';

function start(){
  idx = 0;
  score = {E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};
  isTransitioning = false;
  document.getElementById("hero").style.display = "none";
  document.getElementById("panel").style.display = "block";
  document.getElementById("statusTag").innerText = "测试进行中";
  // 隐藏解锁悬浮条（答题过程中不显示）
  var unlockBar = document.getElementById('unlockBar');
  if (unlockBar) unlockBar.classList.remove('is-show');
  trackEvent('funnel', 'test_start', 'begin');
  renderQuestion(true);
}

function showDemo(){
  // 直接设置状态，不调 start() 避免闪烁
  idx = 16;
  score = {E:3,I:1,S:1,N:3,T:1,F:3,J:1,P:3}; // 模拟 ENFP 分数，维度条显示真实比例
  finalType = "ENFP";
  isTransitioning = false;
  document.getElementById("hero").style.display = "none";
  document.getElementById("panel").style.display = "block";
  document.getElementById("statusTag").innerText = "示例模式";
  trackEvent('funnel', 'demo_viewed', 'ENFP');
  renderResult("ENFP");
}


function renderQuestion(animate){
  const q = questions[idx];
  trackEvent('funnel', 'question_reached', 'q' + (idx + 1), idx + 1);
  const panel = document.getElementById("panel");
  if(panel) panel.classList.remove("panel-result");
  const pct = Math.round(((idx)/questions.length)*100);
  document.getElementById("step").innerText = "题目进度";
  document.getElementById("progress").innerText = `${idx+1}/${questions.length}`;
  setBar((idx)/questions.length);

  const backBtn = idx > 0 ? `<button class="back-btn" onclick="goBack()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>上一题</button>` : '';

  document.getElementById("content").innerHTML = `
    <div class="quiz-card ${animate ? 'quiz-enter' : ''}">
      <div class="q">${q.q}</div>
      <button class="opt" id="optA" onclick="choose('A')">A. ${q.A}</button>
      <button class="opt" id="optB" onclick="choose('B')">B. ${q.B}</button>
      <div class="quiz-footer">
        <div class="quiz-footer-left">${backBtn}</div>
        <div class="progress-text">${pct}% 已完成 · 还剩 ${questions.length - idx} 题</div>
        <div class="quiz-footer-right"></div>
      </div>
    </div>
  `;
}

function goBack(){
  if(isTransitioning || idx <= 0 || answerHistory.length === 0) return;
  isTransitioning = true;
  const last = answerHistory.pop();
  Object.keys(last.scoreApplied).forEach(k => score[k] -= last.scoreApplied[k]);
  const card = document.querySelector('.quiz-card');
  if(card) card.classList.add('quiz-exit');
  setTimeout(()=>{
    idx = last.idx;
    renderQuestion(true);
    isTransitioning = false;
  }, 150);
}

function choose(which){
  if(isTransitioning) return;
  isTransitioning = true;

  const q = questions[idx];
  const s = (which === "A") ? q.scoreA : q.scoreB;
  answerHistory.push({ idx: idx, choice: which, scoreApplied: {...s} });
  Object.keys(s).forEach(k => score[k] += s[k]);

  // 选中反馈
  const btn = document.getElementById(which === 'A' ? 'optA' : 'optB');
  if(btn) btn.classList.add('opt-selected');

  // 延迟后切题
  setTimeout(()=>{
    const card = document.querySelector('.quiz-card');
    if(card) card.classList.add('quiz-exit');

    setTimeout(()=>{
      idx += 1;
      if(idx >= questions.length){
        // 仪式感加载：分阶段展示趣味文案
        finalType = calcType();
        const loadingTexts = [
          { text: "正在翻译 TA 对你的真实评价...", sub: "（建议做好心理准备）" },
          { text: "正在匹配 TA 的真面目...", sub: "在 16 种宠格中锁定它" },
          { text: "审判报告生成中...", sub: "即将揭穿 ✨" }
        ];
        let loadingStep = 0;
        const contentEl = document.getElementById("content");
        function showLoadingStep() {
          const t = loadingTexts[loadingStep];
          contentEl.innerHTML = '<div class="calc-loading"><div class="calc-spinner"></div><div class="calc-text">' + t.text + '</div><div class="calc-sub">' + t.sub + '</div></div>';
        }
        showLoadingStep();
        const loadingInterval = setInterval(()=>{
          loadingStep++;
          if (loadingStep < loadingTexts.length) {
            showLoadingStep();
          } else {
            clearInterval(loadingInterval);
            // 检查是否已有头像
            const hasCustomAvatar = (function(){
              try { return !!localStorage.getItem(AVATAR_KEY); } catch(e){ return false; }
            })();
            if (hasCustomAvatar) avatarUploaded = true;
            // 直接展示结果页，不再弹头像引导
            renderResult(finalType);
            isTransitioning = false;
          }
        }, 900);
      }else{
        renderQuestion(true);
        isTransitioning = false;
      }
    }, 150);
  }, 150);
}

function calcType(){
  const EI = (score.E >= score.I) ? "E" : "I";
  const SN = (score.S >= score.N) ? "S" : "N";
  const TF = (score.T >= score.F) ? "T" : "F";
  const JP = (score.J >= score.P) ? "J" : "P";
  return EI+SN+TF+JP;
}

const subTitles = {
  E: "据说这种猫咪在群里最受欢迎😆",
  I: "外冷内热的小甜心就是它吧✨",
  S: "稳重可靠的居家小卫士🐱",
  N: "脑回路清奇的机灵鬼本鬼🧠"
};


function getAvatar(){
  try{ return localStorage.getItem(AVATAR_KEY) || DEFAULT_AVATAR; }
  catch(e){ return DEFAULT_AVATAR; }
}

function applyAvatar(){
  const avatarUrl = getAvatar();
  const img = document.getElementById("avatarImg");
  const imgPoster = document.getElementById("avatarImgPoster");
  const imgPosterFree = document.getElementById("avatarImgPosterFree");
  if(img) img.src = avatarUrl;
  if(imgPoster) imgPoster.src = avatarUrl;
  if(imgPosterFree) imgPosterFree.src = avatarUrl;
}

function openAvatarPicker(){
  const input = document.getElementById("avatarInput");
  if(input){ input.value = ""; input.click(); }
}

function clickAvatar(){
  openAvatarPicker();
}

function handleAvatarChange(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      try {
        // 居中裁切为正方形 200x200，JPEG 0.8 质量（约 10-30KB）
        const canvas = document.createElement('canvas');
        const SIZE = 200;
        canvas.width = SIZE; canvas.height = SIZE;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        canvas.getContext('2d').drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        try { localStorage.setItem(AVATAR_KEY, compressed); }
        catch(storageErr) { console.warn('localStorage full, avatar in memory only'); }
        avatarUploaded = true;
        // 直接应用压缩后的头像
        const avatarImg = document.getElementById("avatarImg");
        const avatarImgPoster = document.getElementById("avatarImgPoster");
        if(avatarImg) avatarImg.src = compressed;
        if(avatarImgPoster) avatarImgPoster.src = compressed;
        // 清除头像提醒卡（如果存在）
        const remindContainer = document.getElementById("avatarRemindContainer");
        if(remindContainer) remindContainer.innerHTML = "";
        // 检查全屏海报是否已打开，若打开则刷新
        const fsPoster = document.getElementById("posterFullscreen");
        if(fsPoster && fsPoster.classList.contains("is-show")){
          savePoster({ autoDownload:false, showLoadingToast:false, showSuccessToast:true, refreshOnly:true });
        } else if(_fromRemindCard){
          // 从提醒卡上传头像后，自动生成海报
          _fromRemindCard = false;
          savePoster();
        }
      } catch(compressErr) {
        console.error('Avatar compression failed:', compressErr);
        toast("头像处理失败，请换一张试试");
      }
    };
    img.onerror = function(){ toast("头像加载失败，请换一张图片"); };
    img.src = ev.target.result;
  };
  reader.onerror = function(){ toast("文件读取失败"); };
  reader.readAsDataURL(file);
}

/* ==========================================
 * 头像引导页（答题完成后 → 结果页之前）
 * ========================================== */
function renderAvatarPrompt(type) {
  trackEvent('avatar', 'avatar_prompt_shown', type);
  document.getElementById("content").innerHTML = `
    <div class="avatar-prompt">
      <div class="avatar-prompt-title">🎉 审判完成！</div>
      <div class="avatar-prompt-circle" id="avatarPromptCircle" onclick="avatarPromptUpload()">
        <div class="prompt-placeholder">
          <span class="camera-icon">📷</span>
          <span>点击上传照片</span>
        </div>
        <img id="avatarPromptImg" alt="预览" />
        <div class="check-mark">✓</div>
      </div>
      <input id="avatarPromptInput" type="file" accept="image/*" style="display:none" onchange="handleAvatarPromptChange(event)" />
      <div class="avatar-prompt-desc">
        上传你家猫的照片<br/>让审判报告更有排面 ✨
      </div>
      <button class="avatar-prompt-btn" id="avatarPromptBtn" onclick="avatarPromptContinue()">上传照片，生成审判报告</button>
      <button class="avatar-prompt-skip" onclick="avatarPromptSkip()">先跳过，直接看结果</button>
    </div>
  `;
}

function avatarPromptUpload() {
  const input = document.getElementById("avatarPromptInput");
  if (input) { input.value = ""; input.click(); }
}

function handleAvatarPromptChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      try {
        // 居中裁切为正方形 200x200, JPEG 0.8
        const canvas = document.createElement('canvas');
        const SIZE = 200;
        canvas.width = SIZE; canvas.height = SIZE;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        canvas.getContext('2d').drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        try { localStorage.setItem(AVATAR_KEY, compressed); }
        catch(storageErr) { console.warn('localStorage full, avatar in memory only'); }

        avatarUploaded = true;

        // 更新引导页预览
        const circle = document.getElementById("avatarPromptCircle");
        const previewImg = document.getElementById("avatarPromptImg");
        if (circle) circle.classList.add("has-photo");
        if (previewImg) { previewImg.src = compressed; previewImg.style.display = "block"; }

        // 按钮文案变更
        const btn = document.getElementById("avatarPromptBtn");
        if (btn) btn.textContent = "查看我的专属结果 🐾";

        trackEvent('avatar', 'avatar_uploaded', 'prompt_page');
      } catch(err) {
        console.error('Avatar prompt compression failed:', err);
        toast("头像处理失败，请换一张试试");
      }
    };
    img.onerror = function() { toast("头像加载失败，请换一张图片"); };
    img.src = ev.target.result;
  };
  reader.onerror = function() { toast("文件读取失败"); };
  reader.readAsDataURL(file);
}

function avatarPromptContinue() {
  // 如果还没上传照片，点主按钮也触发文件选择
  if (!avatarUploaded) {
    avatarPromptUpload();
    return;
  }
  renderResult(finalType);
}

function avatarPromptSkip() {
  trackEvent('avatar', 'avatar_prompt_skip', finalType);
  renderResult(finalType);
}

/* ==========================================
 * 模块化构建函数
 * ========================================== */

// 构建情绪泡泡图 HTML
function buildEmotionBubbles(r) {
  const layout = [
    { size:'lg', x:-65, y:-45, color:'#FF6B81', delay:'0s' },
    { size:'md', x:58, y:-52, color:'#FFD666', delay:'0.3s' },
    { size:'sm', x:75, y:22, color:'#7ED9A6', delay:'0.6s' },
    { size:'md', x:-55, y:38, color:'#C4A6FF', delay:'0.9s' },
    { size:'sm', x:5, y:68, color:'#8CC8FF', delay:'1.2s' },
    { size:'lg', x:12, y:-72, color:'#FFB074', delay:'0.5s' },
    { size:'sm', x:-70, y:-5, color:'#FF6B81', delay:'0.8s' },
  ];
  return (r.bubbles||[]).slice(0,7).map((b,i) => {
    const l = layout[i] || layout[0];
    return `<span class="bubble bubble-${l.size}" style="--x:${l.x}px;--y:${l.y}px;--color:${l.color};--delay:${l.delay}">${b}</span>`;
  }).join("");
}

// 构建维度条形图 HTML
function buildDimensionRows(score) {
  const config = [
    { left:'社牛', right:'社恐', lKey:'E', rKey:'I', lColor:'#FF6B81', rColor:'#C4A6FF', label:'社牛指数' },
    { left:'细节控', right:'脑洞王', lKey:'S', rKey:'N', lColor:'#FFB074', rColor:'#8CC8FF', label:'脑回路' },
    { left:'铁面判官', right:'玻璃心', lKey:'T', rKey:'F', lColor:'#7ED9A6', rColor:'#FFD666', label:'心软指数' },
    { left:'强迫症', right:'随缘大师', lKey:'J', rKey:'P', lColor:'#FF6B81', rColor:'#7ED9A6', label:'作息规律' },
  ];
  return config.map(d => {
    const total = score[d.lKey] + score[d.rKey];
    const lPct = total === 0 ? 50 : Math.round((score[d.lKey]/total)*100);
    const rPct = 100 - lPct;
    return `<div class="dim-title-label">${d.label}</div>
      <div class="dim-row">
        <span class="dim-label dim-left">${d.left}</span>
        <div class="dim-bar-track">
          <div class="dim-bar-fill" style="width:${lPct}%;--bar-color:${d.lColor}">${lPct}%</div>
          <div class="dim-bar-fill" style="width:${rPct}%;--bar-color:${d.rColor}">${rPct}%</div>
        </div>
        <span class="dim-label dim-right">${d.right}</span>
      </div>`;
  }).join("");
}

// 构建性格画像 HTML 片段
function buildPersonaSections(r) {
  return {
    traitsHtml: (r.profile?.traits||[]).map(t => `<li>${t}</li>`).join(""),
    behaviorsHtml: (r.profile?.behaviors||[]).map(t => `<li>${t}</li>`).join(""),
    vsInner: r.profile?.innerVsOuter?.inner || [],
    vsOuter: r.profile?.innerVsOuter?.outer || []
  };
}

// 构建主人指南 HTML
function buildGuideSections(r) {
  const data = [
    { icon:'🤝', title:'如何相处', items: r.guide?.relationship || [] },
    { icon:'🍖', title:'喂养指南', items: r.guide?.feeding || [] },
    { icon:'🎾', title:'玩具与互动', items: r.guide?.toys || [] },
    { icon:'💛', title:'情绪与心理', items: r.guide?.emotion || [] },
  ];
  return data.map(g => {
    const lis = g.items.map(i => `<li>${i}</li>`).join("");
    return `<div class="guide-card"><div class="guide-title">${g.icon} ${g.title}</div><ul>${lis}</ul></div>`;
  }).join("");
}

// 构建海报泡泡 HTML
function buildPosterBubbles(r) {
  const colors = ['#FF6B81','#FFD666','#7ED9A6','#C4A6FF','#8CC8FF','#FFB074'];
  const layout = [
    { size:'lg', left:'18px',  top:'22px' },
    { size:'lg', left:'96px',  top:'0px' },
    { size:'md', left:'178px', top:'16px' },
    { size:'md', left:'32px',  top:'108px' },
    { size:'sm', left:'110px', top:'118px' },
    { size:'md', left:'168px', top:'100px' },
  ];
  return (r.bubbles||[]).slice(0,6).map((b,i) => {
    const p = layout[i];
    return `<span class="p-bubble p-bubble-${p.size}" style="background:${colors[i]};left:${p.left};top:${p.top}">${b}</span>`;
  }).join("");
}

// 构建海报维度条 HTML
function buildPosterDimRows(score) {
  const config = [
    { left:'社牛', right:'社恐', lKey:'E', rKey:'I', lColor:'#FF6B81', rColor:'#C4A6FF' },
    { left:'细节控', right:'脑洞王', lKey:'S', rKey:'N', lColor:'#FFB074', rColor:'#8CC8FF' },
    { left:'铁面', right:'玻璃心', lKey:'T', rKey:'F', lColor:'#7ED9A6', rColor:'#FFD666' },
    { left:'强迫症', right:'随缘', lKey:'J', rKey:'P', lColor:'#FF6B81', rColor:'#7ED9A6' },
  ];
  return config.map(d => {
    const total = score[d.lKey] + score[d.rKey];
    const lPct = total === 0 ? 50 : Math.round((score[d.lKey]/total)*100);
    const rPct = 100 - lPct;
    return `<div class="p-dim-row">
      <span class="p-dim-label p-dim-left">${d.left}</span>
      <div class="p-dim-track">
        <div class="p-dim-fill" style="width:${lPct}%;background:${d.lColor}">${lPct}%</div>
        <div class="p-dim-fill" style="width:${rPct}%;background:${d.rColor}">${rPct}%</div>
      </div>
      <span class="p-dim-label p-dim-right">${d.right}</span>
    </div>`;
  }).join("");
}

/* ==========================================
 * 结果页渲染（组合模块化函数）
 * ========================================== */
function renderResult(type){
  var r = results[type];
  if (!r) {
    console.error('Result type not found:', type, '- falling back to ENFP');
    r = results["ENFP"];
    type = "ENFP";
    setTimeout(function(){ toast("结果匹配异常，已显示默认结果"); }, 500);
  }
  finalType = type;
  trackEvent('funnel', 'test_complete', type);
  document.getElementById("statusTag").innerText = "已出结果";
  document.getElementById("step").innerText = "测试完成";
  document.getElementById("progress").innerText = "";
  setBar(1);

  // 使用模块化函数构建各区块
  const tipsHtml = r.tips.slice(0, 3).map(t=>`<li>${t}</li>`).join("");
  const tagsHtml = r.tags.map(t=>`<span class="tag">${t}</span>`).join("");
  const bubblesHtml = buildEmotionBubbles(r);
  const dimHtml = buildDimensionRows(score);
  const persona = buildPersonaSections(r);
  const guideHtml = buildGuideSections(r);
  const posterBubblesHtml = buildPosterBubbles(r);
  const posterDimHtml = buildPosterDimRows(score);

  const panel = document.getElementById("panel");
  if(panel) panel.classList.add("panel-result");

  document.getElementById("content").innerHTML = `
    <div class="page">
      <div class="result-card">
        <div class="result-title">审判结果</div>

        <div class="avatar-wrap">
            <div class="avatar-circle" style="border-color:${typeColors[type]||'#FF6B81'}" onclick="clickAvatar()">
                <img id="avatarImg" alt="头像" />
                <div class="avatar-camera-badge">📷</div>
            </div>
            <input id="avatarInput" type="file" accept="image/*" style="display:none" onchange="handleAvatarChange(event)" />
        </div>

        <div class="result-type" style="color:${typeColors[type]||'#FF6B81'}">${typeCodeMap[type]||type}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-line">"${r.line}"</div>
        <div class="rarity-card">
          <div class="rarity-badge ${r.rarity <= 4 ? 'rarity-ssr' : r.rarity <= 6 ? 'rarity-sr' : 'rarity-r'}">${r.rarity <= 4 ? 'SSR' : r.rarity <= 6 ? 'SR' : 'R'}</div>
          <div class="rarity-text">全国仅 <strong>${r.rarity}%</strong> 的猫咪是这个类型</div>
        </div>

        <div class="result-tags">${tagsHtml}</div>

        <!-- 维度条形图（免费展示） -->
        <div class="dim-section">
          <div class="section-title">四维扫描</div>
          ${dimHtml}
        </div>

        <!-- 内心独白（免费展示） -->
        <div class="monologue-card">
          <div class="monologue-label">TA的内心OS</div>
          <div class="monologue-text">"${r.monologue}"</div>
        </div>

        ${r.desc ? `
        <!-- 类型长文解读（免费展示） -->
        <div class="result-desc-card">
          <div class="result-desc-text">${r.desc}</div>
        </div>
        ` : ''}

        <!-- ===== 解锁分割线 ===== -->
        <div class="lock-divider">
          <div class="lock-divider-line"></div>
          <div class="lock-divider-text">🔒 TA还有更多黑料</div>
          <div class="lock-divider-line"></div>
        </div>

        <!-- 预览钩子：露出第一条性格特点 -->
        <div class="unlock-teaser" onclick="showUnlockModal()">
          <div class="teaser-trait">✨ ${(r.profile?.traits||[])[0] || ''}</div>
          <div class="teaser-more">黑料太多放不下... 🔓 免费解锁查看</div>
        </div>

        <!-- 🔒 心理 vs 外在（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="vs-card">
              <div class="sub-title" style="font-size:15px;font-weight:800;color:#2D2A26;margin-bottom:12px;">🎭 嘴上说的 vs 身体做的</div>
              ${(Array.isArray(persona.vsInner) ? persona.vsInner : [persona.vsInner]).map((inner, i) => {
                const outer = Array.isArray(persona.vsOuter) ? persona.vsOuter[i] : persona.vsOuter;
                return `<div class="vs-row" ${i > 0 ? 'style="margin-top:10px;padding-top:10px;border-top:1px dashed #E8E0D8;"' : ''}>
                <div class="vs-col">
                  ${i === 0 ? '<div class="vs-label">内心世界</div>' : ''}
                  <div class="vs-text">${inner || ''}</div>
                </div>
                <div class="vs-divider"></div>
                <div class="vs-col">
                  ${i === 0 ? '<div class="vs-label">外在表现</div>' : ''}
                  <div class="vs-text">${outer || ''}</div>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 🔒 情绪泡泡图（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="bubble-section">
              <div class="section-title">它的情绪泡泡</div>
              <div class="bubble-chart">
                <div class="bubble-container">
                  ${bubblesHtml}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 🔒 详细犯罪档案（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="profile-section">
              <div class="section-title">犯罪档案</div>
              <div class="profile-card">
                <div class="sub-title">✨ 主要罪状</div>
                <ul>${persona.traitsHtml}</ul>
              </div>
              <div class="profile-card">
                <div class="sub-title">🐾 作案手法</div>
                <ul>${persona.behaviorsHtml}</ul>
              </div>
            </div>
          </div>
        </div>

        <!-- 🔒 驯服手册（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="guide-section">
              <div class="section-title">驯服手册</div>
              <div class="tips-card" style="margin-bottom:14px;">
                <div class="sub-title">⚡ 生存指南</div>
                <ul>${tipsHtml}</ul>
              </div>
              ${guideHtml}
            </div>
          </div>
        </div>

        <div class="hr"></div>

        <!-- 海报卡（豪华版）：9:16长图 540x960 -->
        <div id="resultCard" class="poster">
          <div class="poster-brand">猫咪PBTI · 萌宠联萌</div>
          <div class="p-avatar"><img id="avatarImgPoster" alt="头像" /></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${typeCodeMap[type]||type}</div>
          <div class="p-name">${r.name}</div>
          <div class="p-line">"${r.line}"</div>
          <div class="p-rarity">🐾 仅占所有测试猫咪的 ${r.rarity}%</div>
          <div class="p-monologue">"${r.monologue.length > 30 ? r.monologue.substring(0, 30) + '...' : r.monologue}"</div>
          <div class="p-tags">${r.tags.map(t=>'<span class="p-tag">'+t+'</span>').join('')}</div>
          <div class="p-section-title">它的情绪泡泡</div>
          <div class="p-bubbles">${posterBubblesHtml}</div>
          <div class="p-section-title">四维扫描</div>
          <div class="p-dims">${posterDimHtml}</div>
          <div class="p-footer">
            <div class="p-footer-text">
              <div class="p-footer-title">扫码测测你家毛孩子</div>
              <div class="p-footer-sub">1分钟出结果 · 16种性格</div>
            </div>
            <div class="p-footer-qr" id="posterQrCode"></div>
          </div>
        </div>

        <!-- 海报卡（免费版/精简版）：9:16长图 540x960 -->
        <div id="resultCardFree" class="poster poster-free">
          <div class="poster-brand">猫咪PBTI · 萌宠联萌</div>
          <div class="pf-spacer-top"></div>
          <div class="p-avatar"><img id="avatarImgPosterFree" alt="头像" /></div>
          <div class="pf-spacer"></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${typeCodeMap[type]||type}</div>
          <div class="p-name">${r.name}</div>
          <div class="pf-spacer"></div>
          <div class="p-line">"${r.line}"</div>
          <div class="pf-spacer-sm"></div>
          <div class="p-rarity">🐾 仅占所有测试猫咪的 ${r.rarity}%</div>
          <div class="pf-spacer"></div>
          <div class="p-tags">${r.tags.map(t=>'<span class="p-tag">'+t+'</span>').join('')}</div>
          <div class="pf-spacer-lg"></div>
          <div class="pf-unlock-hint">
            <div class="pf-unlock-icon">🔓</div>
            <div class="pf-unlock-text">扫码解锁完整性格报告</div>
            <div class="pf-unlock-sub">含情绪泡泡 · 四维扫描 · 驯服手册</div>
          </div>
          <div class="p-footer">
            <div class="p-footer-text">
              <div class="p-footer-title">扫码测测你家毛孩子</div>
              <div class="p-footer-sub">1分钟出结果 · 16种性格</div>
            </div>
            <div class="p-footer-qr" id="posterQrCodeFree"></div>
          </div>
        </div>

        <div id="avatarRemindContainer"></div>
        <div class="btns">
          <button class="btn-primary" id="posterBtn" onclick="handleGeneratePoster()">生成审判报告</button>
        </div>
        <div class="btns">
          <button class="btn-share" onclick="copyShareText()">一键复制晒圈文案</button>
        </div>

        <div class="btns">
          <button class="btn-ghost" onclick="start()">不服，再审一次</button>
        </div>

        <div class="community-card">
          <div style="font-weight:900; color:var(--pri); font-size:15px; margin-bottom:4px;">🎁 免费领取驯服手册</div>
          <div class="muted" style="font-size:12px; margin-bottom:12px;">加企微领取 + 进同品种铲屎官互助群</div>
          <div class="btns" style="margin-top:0;">
            <button class="btn-primary" onclick="trackEvent('funnel','wecom_button_clicked',finalType||'unknown');showWecomModal()">立即领取</button>
          </div>
        </div>
        <!-- 底部间距，防止被悬浮解锁条遮挡 -->
        <div style="height:70px;"></div>
      </div>
    </div>
  `;





  // 头像渲染
  applyAvatar();

  // 渲染二维码
  renderQRCode(getTestLink());

  // 海报底部二维码动态生成（豪华版+免费版）
  var _qrConfig = {
    text: getTestLink(),
    width: 72,
    height: 72,
    colorDark: "#1a1a1a",
    colorLight: "#ffffff",
    correctLevel: QRCode.Level ? QRCode.Level.H : 3
  };
  var posterQrContainer = document.getElementById('posterQrCode');
  if (posterQrContainer && typeof QRCode !== 'undefined') {
    posterQrContainer.innerHTML = '';
    new QRCode(posterQrContainer, _qrConfig);
  }
  var posterQrContainerFree = document.getElementById('posterQrCodeFree');
  if (posterQrContainerFree && typeof QRCode !== 'undefined') {
    posterQrContainerFree.innerHTML = '';
    new QRCode(posterQrContainerFree, _qrConfig);
  }

  // 检查解锁状态 + 更新海报按钮文案
  checkAndApplyUnlockState();
  updatePosterBtnText();
}


function showWecomModal() {
  const typeLabel = document.getElementById("wecomTypeLabel");
  const sbtiLabel = (typeCodeMap[finalType] || finalType) + '·' + (results[finalType]?.name || '猫咪宠格');
  if(typeLabel) typeLabel.innerText = sbtiLabel;
  document.getElementById("wecomModal").style.display = "flex";
  trackEvent('funnel', 'wecom_modal_shown', finalType || 'unknown');
}

/* ===== 海报全屏预览控制 ===== */
function closePosterFullscreen() {
  const fs = document.getElementById("posterFullscreen");
  if (fs) fs.classList.remove("is-show");
}

function posterFsChangeAvatar() {
  openAvatarPicker();
}

// 点击遮罩空白区域关闭
(function(){
  var fs = document.getElementById("posterFullscreen");
  if (fs) {
    fs.addEventListener("click", function(e) {
      if (e.target === fs) closePosterFullscreen();
    });
  }
})();

function closeWecomModal() {
  document.getElementById("wecomModal").style.display = "none";
}

document.addEventListener("click", function(e){
  const mask = document.getElementById("wecomModal");
  if(mask && e.target === mask) closeWecomModal();
});

/* ==========================================
 * 内容解锁系统
 * ========================================== */

// 检查并应用解锁状态
function checkAndApplyUnlockState() {
  let isUnlocked = false;
  try { isUnlocked = localStorage.getItem(UNLOCK_KEY) === 'true'; } catch(e) {}

  const resultCard = document.querySelector('.result-card');
  const unlockBar = document.getElementById('unlockBar');

  if (isUnlocked) {
    // 已解锁：去掉所有遮罩
    if (resultCard) resultCard.classList.add('unlocked');
    if (unlockBar) unlockBar.classList.remove('is-show');
  } else {
    // 未解锁：显示遮罩和底部悬浮条
    if (resultCard) resultCard.classList.remove('unlocked');
    if (unlockBar) unlockBar.classList.add('is-show');
  }
}

// 显示解锁弹窗（始终从第一屏开始）
function showUnlockModal() {
  const modal = document.getElementById('unlockModal');
  if (!modal) return;

  // 重置为第一屏
  var s1 = document.getElementById('unlockScreen1');
  var s2 = document.getElementById('unlockScreen2');
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';

  modal.classList.add('is-show');

  // 隐藏倒计时，立即显示两个按钮
  var countdownWrap = document.getElementById('unlockCountdown');
  var confirmBtn = document.getElementById('unlockConfirmBtn');
  var skipBtn = document.getElementById('unlockSkip');
  if (countdownWrap) countdownWrap.style.display = 'none';
  if (confirmBtn) confirmBtn.classList.add('is-show');
  if (skipBtn) skipBtn.classList.add('is-show');

  trackEvent('funnel', 'unlock_modal_shown', finalType || 'unknown');
}

// 点击"暂时跳过"→ 切换到第二屏
function showUnlockScreen2() {
  if (unlockCountdownTimer) {
    clearTimeout(unlockCountdownTimer);
    unlockCountdownTimer = null;
  }
  var s1 = document.getElementById('unlockScreen1');
  var s2 = document.getElementById('unlockScreen2');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = '';
  trackEvent('funnel', 'unlock_skip_to_screen2', finalType || 'unknown');
}

// 关闭解锁弹窗
function closeUnlockModal() {
  var modal = document.getElementById('unlockModal');
  if (modal) modal.classList.remove('is-show');
  if (unlockCountdownTimer) {
    clearTimeout(unlockCountdownTimer);
    unlockCountdownTimer = null;
  }
}

// 点击遮罩关闭解锁弹窗
document.addEventListener("click", function(e){
  const mask = document.getElementById("unlockModal");
  if(mask && e.target === mask) closeUnlockModal();
});

// 确认解锁
function confirmUnlock() {
  // 保存解锁状态
  try { localStorage.setItem(UNLOCK_KEY, 'true'); } catch(e) {}

  // 关闭弹窗
  closeUnlockModal();

  // 应用解锁效果
  const resultCard = document.querySelector('.result-card');
  const unlockBar = document.getElementById('unlockBar');
  if (resultCard) resultCard.classList.add('unlocked');
  if (unlockBar) unlockBar.classList.remove('is-show');

  // 更新海报按钮文案
  updatePosterBtnText();

  // 埋点
  trackEvent('funnel', 'content_unlocked', finalType || 'unknown');

  // 提示
  toast('🎉 完整报告已解锁');
}

// 根据解锁状态更新海报按钮文案
function updatePosterBtnText() {
  var btn = document.getElementById('posterBtn');
  if (!btn) return;
  var isUnlocked = false;
  try { isUnlocked = localStorage.getItem(UNLOCK_KEY) === 'true'; } catch(e) {}
  btn.textContent = isUnlocked ? '✨ 生成专属海报' : '生成审判报告';
}

function renderQRCode(url){
  if (typeof QRCode === 'undefined') { console.warn('QRCode library not loaded'); return; }
  // 确保 url 是可访问的 http/https 地址，file:// 协议会影响部分扫码器
  const validUrl = url.startsWith('http') ? url : 'https://www.mclmpet.com/cat/'; // 兜底线上地址

  const container = document.getElementById("qrcode");

  if(!container) return;
  container.innerHTML = "";
  new QRCode(container, {
    text: validUrl,
    width: 96,
    height: 110,
    colorDark : "#1a1a1a",
    colorLight : "#ffffff",
    correctLevel : QRCode.Level ? QRCode.Level.H : 3 // QRCode.Level 可能不存在，Level.H 对应 3
  });
}

/* 一键复制晒圈文案 */
function copyShareText() {
  const r = results[finalType];
  if (!r) return;
  const rarityTag = r.rarity <= 4 ? '超稀有SSR' : r.rarity <= 6 ? '稀有SR' : r.rarity <= 8 ? '少见' : '';
  const sbtiCode = typeCodeMap[finalType] || finalType;
  const text = `我家猫的PBTI是「${sbtiCode}·${r.name}」！${r.line}\n${rarityTag ? rarityTag + '！' : ''}全国仅${r.rarity}%的猫咪是这个类型～\n你家毛孩子是什么东西？→ www.mclmpet.com\n#猫咪PBTI #宠物性格测试`;
  const onSuccess = () => {
    const btn = document.querySelector('.btn-share');
    if (btn) { btn.textContent = '已复制，去发朋友圈吧'; setTimeout(() => { btn.textContent = '一键复制晒圈文案'; }, 2500); }
  };
  const fallbackCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch(e) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
  trackEvent('funnel', 'share_text_copied', finalType);
}

/* 点击"生成结果图"入口：检查是否需要提醒上传头像 */
function handleGeneratePoster() {
  const isDefault = !avatarUploaded && (function(){
    try { return !localStorage.getItem(AVATAR_KEY); } catch(e){ return true; }
  })();
  const container = document.getElementById("avatarRemindContainer");

  if (isDefault && container && !container.querySelector('.avatar-remind-card')) {
    trackEvent('avatar', 'avatar_remind_shown', finalType);
    container.innerHTML = `
      <div class="avatar-remind-card">
        <div class="remind-icon">📷</div>
        <div class="remind-text"><strong>上传 TA 的照片，审判报告更有排面</strong><br/>有头像的报告才值得发朋友圈</div>
        <div class="remind-actions">
          <button class="remind-btn remind-btn-upload" onclick="remindUploadAvatar()">上传照片</button>
          <button class="remind-btn remind-btn-skip" onclick="remindSkipAvatar()">先用默认头像</button>
        </div>
      </div>
    `;
    return;
  }
  savePoster();
}

let _fromRemindCard = false;
function remindUploadAvatar() {
  _fromRemindCard = true;
  openAvatarPicker();
  // 关闭提醒卡
  const container = document.getElementById("avatarRemindContainer");
  if (container) container.innerHTML = "";
}

function remindSkipAvatar() {
  const container = document.getElementById("avatarRemindContainer");
  if (container) container.innerHTML = "";
  savePoster();
}

async function savePoster(options = {}){
  try{
    const opts = {
      autoDownload: true,
      showLoadingToast: true,
      showSuccessToast: true,
      refreshOnly: false,
      ...options
    };

    // 懒加载 html2canvas（首次生成海报时才下载）
    try { await ensureHtml2Canvas(); } catch(e) {}
    if (typeof html2canvas === 'undefined') {
      toast("海报组件加载失败，请刷新页面重试");
      return;
    }

    // 根据解锁状态选择海报版本
    var _isUnlockedForPoster = false;
    try { _isUnlockedForPoster = localStorage.getItem(UNLOCK_KEY) === 'true'; } catch(e) {}
    const posterId = _isUnlockedForPoster ? "resultCard" : "resultCardFree";
    const el = document.getElementById(posterId);
    if(!el){ toast("没找到结果卡"); return; }

    if(opts.showLoadingToast){
      toast(opts.refreshOnly ? "正在更新海报..." : "海报生成中...");
    }
    // 延迟确保二维码渲染完成
    await new Promise(resolve => setTimeout(resolve, 150));

    // 临时切换为 absolute 以便 html2canvas 正确捕获
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '-1';

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: 540,
      height: 960
    });

    // 恢复 fixed 定位
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.zIndex = '';


    const dataUrl = canvas.toDataURL("image/png");

    // 全屏遮罩展示海报
    const fsImg = document.getElementById("posterFsImg");
    const fs = document.getElementById("posterFullscreen");
    if (fsImg) fsImg.src = dataUrl;
    if (fs && !opts.refreshOnly) fs.classList.add("is-show");

    // PC 尝试下载
    if(opts.autoDownload && !/MicroMessenger/i.test(navigator.userAgent)){
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `猫咪SBTI-${finalType || "RESULT"}.png`;
      a.click();
    }

    if (!opts.refreshOnly) trackEvent('funnel', 'poster_generated', finalType || 'unknown');
    if(opts.showSuccessToast && opts.refreshOnly){
      toast("头像已更新，海报已刷新");
    }

    // 二次转化：用户滚动到社区卡片区域时弹窗（仅限一次）
    // 如果用户已解锁内容，说明已经引导过加企微了，不再自动弹窗
    var _isUnlocked = false;
    try { _isUnlocked = localStorage.getItem(UNLOCK_KEY) === 'true'; } catch(e) {}
    if (!hasShownWecomModal && !_isUnlocked) {
      hasShownWecomModal = true;
      var communityCard = document.querySelector('.community-card');
      if (communityCard && typeof IntersectionObserver !== 'undefined') {
        var wecomObserver = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              wecomObserver.disconnect();
              setTimeout(function(){ showWecomModal(); }, 1000);
            }
          });
        }, { threshold: 0.3 });
        wecomObserver.observe(communityCard);
        // 兜底：15秒后仍未滚动到则自动弹出
        setTimeout(function() {
          wecomObserver.disconnect();
          var modal = document.getElementById("wecomModal");
          if (modal && modal.style.display !== "flex") showWecomModal();
        }, 15000);
      } else {
        // 不支持 IntersectionObserver 的浏览器兜底
        setTimeout(function(){ showWecomModal(); }, 8000);
      }
    }
  }catch(e){

    console.error(e);
    toast("生成失败，请截图保存");
  }
}

function setBar(p){


  const w = Math.max(0, Math.min(1, p)) * 100;
  const bar = document.getElementById("bar");
  if(bar) bar.style.width = w.toFixed(0) + "%";
}

function toast(msg){
  const el = document.getElementById("toast");
  el.innerText = msg;
  el.style.display = "block";
  clearTimeout(window.__t);
  window.__t = setTimeout(()=> el.style.display="none", 2000);
}

// 回到顶部按钮显示/隐藏
(function(){
  var btn = document.getElementById('backToTop');
  if (!btn) return;
  var ticking = false;
  window.addEventListener('scroll', function(){
    if (!ticking) {
      requestAnimationFrame(function(){
        btn.classList.toggle('is-visible', window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

