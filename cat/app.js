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

// 20题：每个维度5题（猫咪向）— 猫咪专属场景+高共情

// 维度：E/I, S/N, T/F, J/P
const questions = [
  // === E/I（社交能量）===
  { id:"E1", dim:"EI", q:"家里来了陌生客人，TA通常：", A:"大摇大摆走出来巡视一圈，甚至跳到客人腿上「接待」", B:"嗖一下钻进床底/柜顶，客人走了才慢慢探头", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E2", dim:"EI", q:"你同时撸TA和另一只猫（或给别的宠物注意力），TA：", A:"挤过来蹭你的手，「我也要！我先！」", B:"默默走开，找个角落自己待着，回头偷偷看你一眼", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E3", dim:"EI", q:"你出门回来推开门的那一刻，TA：", A:"已经蹲在门口等了，喵喵叫着绕你脚边转圈", B:"从某个角落抬头看你一眼，然后继续趴着——「哦，你回来了」", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E4", dim:"EI", q:"如果TA会发朋友圈，你觉得它的风格更像：", A:"每天三条起步，晒吃晒喝晒窗外——生怕没人知道它今天干了啥", B:"三个月才发一条，配图还是模糊的——「别@我，谢谢」", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E5", dim:"EI", q:"平时在家，TA更多时候：", A:"跟着你从客厅到厨房到卧室，你在哪它在哪", B:"有自己固定的「领地」，你来找它可以，它不主动找你", scoreA:{E:1}, scoreB:{I:1}},
  // === S/N（感知方式）===
  { id:"S1", dim:"SN", q:"你买了一个新纸箱放在地上，TA：", A:"先绕着闻一圈，小心翼翼伸爪试探，确认安全才钻进去", B:"看了一秒直接跳进去，管它是什么先占了再说", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S2", dim:"SN", q:"你拿逗猫棒逗TA玩，TA更像：", A:"眼睛紧盯猎物，精准计算距离，一扑一个准", B:"跳起来扑空了也不在意，中途突然去追自己尾巴", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S3", dim:"SN", q:"你觉得TA对家里环境变化的感知方式更像：", A:"精密雷达——你挪了一本书它都能发现，然后盯着看半天", B:"佛系随缘——家具搬了位置也无所谓，反正最后都归它", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S4", dim:"SN", q:"TA盯着窗外发呆的时候，你觉得它脑子里更像在：", A:"认真观察——那只鸟几点来的、从哪飞的，一切尽在掌握", B:"天马行空地神游——也许在想象自己是翱翔天际的猎手吧", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S5", dim:"SN", q:"你在TA面前展示一个新玩具/新物件，TA更像：", A:"先闻、再拍、再咬，按部就班地研究", B:"直接一掌拍飞，或者对着空气发起进攻——自己脑补了一场战争", scoreA:{S:1}, scoreB:{N:1}},
  // === T/F（决策偏好）===
  { id:"T1", dim:"TF", q:"你严厉地对TA说「不行！」（比如它跳上餐桌），TA：", A:"看你一眼，跳下去了——但等你转身，它又跳上来了", B:"耳朵往后压，委屈地瞄你一眼，慢慢走开", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T2", dim:"TF", q:"要让TA配合做不喜欢的事（比如剪指甲/吃药），更管用的是：", A:"快准狠+事后给零食，TA认结果", B:"先抱着哄半天+温柔说话，TA吃氛围", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T3", dim:"TF", q:"你心情很低落，窝在沙发上不动，TA：", A:"该吃吃该睡睡，偶尔路过看你一眼——「你自己会好的」", B:"跳上沙发靠着你坐下，用头蹭蹭你的手——虽然平时不这样", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T4", dim:"TF", q:"家里另一只猫/宠物抢了TA的窝/玩具，TA更可能：", A:"一巴掌呼过去或者强势夺回——「我的地盘我做主」", B:"委屈地看看你，喵了一声，好像在说「你管管啊」", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T5", dim:"TF", q:"TA打碎了你的杯子/花瓶被你当场抓住，TA更像：", A:"面不改色继续舔爪子，一副「嗯是我干的，怎么了」", B:"缩起身子，耳朵压平，用大眼睛可怜巴巴地看着你", scoreA:{T:1}, scoreB:{F:1}},
  // === J/P（生活方式）===
  { id:"J1", dim:"JP", q:"每天早上，TA：", A:"比闹钟还准——到点就跳上床/蹲在饭碗前催你起床", B:"有时四点就闹，有时睡到中午，完全看心情", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J2", dim:"JP", q:"如果TA的生活拍成纪录片，你觉得画风更像：", A:"《猫生作息表》——每天固定的剧情和节奏，精确到分钟", B:"《荒野求生·家居版》——没人知道下一秒它出现在哪，包括它自己", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J3", dim:"JP", q:"TA突然开始「猫咪跑酷」，你觉得背后的原因更像：", A:"到点了——它有自己的运动时刻表，像个准时打卡的健身达人", B:"纯属随机——一片灰尘飘过就触发了它的「战斗模式」，毫无预警", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J4", dim:"JP", q:"你改变了TA的喂食时间或者换了猫粮品牌，TA：", A:"明显不适应，拒绝进食或者反复闻了又走开", B:"无所谓，有得吃就行，适应得很快", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J5", dim:"JP", q:"玩逗猫棒/追逐游戏时，TA的风格：", A:"有章法：蹲伏→瞄准→起跳，每次套路差不多", B:"毫无章法：追两下突然停住舔毛，下一秒又疯了", scoreA:{J:1}, scoreB:{P:1}}
];

// 16型结果库（中文名+金句+建议+标签）——猫咪版
const results = {
  "ENFP": { name:"好奇心炸弹", rarity:8, line:"世界这么大，每个角落都要亲自检查一遍——等下那是什么？！", tags:["社交达人","好奇心爆棚","一秒入戏"],
    monologue:"我知道你嫌我一天到晚上蹿下跳，但你不懂——我是在巡视我的王国！对了，那个塑料袋刚才是不是动了一下？等我去看看。你别走，我马上回来……大概吧。",
    tips:["每天保证两次高质量互动（逗猫棒+藏食游戏）","定期换新玩具保持新鲜感，不然它会去开发你的纸巾盒","高处空间一定要有，它需要登高望远"],
    bubbles:["热情","好奇","活力","跳脱","乐观","社牛","自由"],
    profile:{
      traits:["天生社牛，对所有新鲜事物充满热情","精力旺盛到让你怀疑它充了电","情绪全写在尾巴上——竖起来就是嗨，炸起来就是兴奋过头"],
      behaviors:["家里任何新东西都要第一时间扑上去检查","玩具玩两分钟就丢，转头去研究窗帘绳","快递刚拆开纸箱，它已经坐在里面了"],
      innerVsOuter:{inner:["那个塑料袋动了！一定是猎物！冲啊！","新来的客人！让我展示一下我的魅力！","好累…但那边好像又有动静？"],outer:["一头扎进塑料袋里出不来了","跳到客人肩上把人吓一跳","打着哈欠还在追逗猫棒"]}
    },
    guide:{
      relationship:["每天给它'探索时间'，让它闻新东西、看新视频；好奇心被满足了就不搞破坏","给予正面反馈，它靠认可驱动"],
      feeding:["少量多餐，配合漏食球增加进食趣味；直接放饭碗太无聊","注意体重管理，兴奋状态下别喂零食"],
      toys:["逗猫棒、弹力球、纸袋纸箱是标配；三天换一批才够","益智类玩具轮换使用保持新鲜感","藏食游戏消耗脑力"],
      emotion:["它的'疯跑'不是发疯，是在释放能量","冷落它会让它找别的目标（比如你的沙发）"]
    }},
  "ENFJ": { name:"温柔管家喵", rarity:5, line:"你还没回来，我就已经在门口等了——因为我知道你今天很累。", tags:["情绪感知","治愈系","操心命"],
    monologue:"你以为我蹭你是在撒娇，其实我在确认你开不开心。你叹了口气，我听到了。你把脸埋进手里，我也看到了。我不会说话，但我可以坐在你旁边，用体温告诉你：我在。",
    tips:["多用语言和抚摸给予回应，它需要'被认可'","家里有争吵时注意安抚它，它会内化负面情绪","社交安排以熟悉的人为主，它不喜欢太混乱的场面"],
    bubbles:["共情","温暖","忠诚","体贴","敏锐","守护"],
    profile:{
      traits:["天生的情绪探测器，你难过它一定知道","喜欢在家里'巡逻'，确认每个角落都安全","对家里所有成员一视同仁地关心"],
      behaviors:["你哭的时候它会跳到你腿上蹭你","家里有人关门声大了它会紧张地过来看看","每天早上依次去每个房间'查岗'"],
      innerVsOuter:{inner:["你叹气了…你是不是不开心？我过去陪你","那个人关门好大声…是不是出事了？","你今天夸我了！我可以开心一整天！"],outer:["默默跳上沙发靠着你坐下","跑去门口探头探脑地确认","咕噜声大到整条街都听得见"]}
    },
    guide:{
      relationship:["多跟它说话，它听得懂你的语气；给它一个'陪伴岗位'（比如固定坐你旁边的位置）","多夸奖多抚摸，它需要持续的正面反馈"],
      feeding:["定时定量，它喜欢有规律的生活；吃饭时可以轻声跟它说话","可以用喂食时间做简单互动"],
      toys:["喜欢和你一起玩的互动玩具；独自玩的兴趣不大","适合柔软的陪伴型玩偶"],
      emotion:["避免在它面前激烈争吵；分离时间不宜太长，它会焦虑","给它稳定的日常节奏就是最好的安全感"]
    }},
  "ENTP": { name:"柜顶拆迁办", rarity:6, line:"你说桌上的杯子不能碰？那我试试推到什么程度你才会来管。", tags:["高智商","爱搞事","试探边界"],
    monologue:"你说我在搞破坏？不不不，我在做实验。比如这个杯子，我已经验证了——推到桌子边缘2厘米你就会大叫。这是非常有价值的科学数据。",
    tips:["必须给足够的脑力挑战：益智喂食器、藏食游戏","家里易碎品收好，不是它坏，是它太聪明","训练不能太重复，变着花样来它才配合"],
    bubbles:["聪明","调皮","探索","机灵","挑战","创造","大胆"],
    profile:{
      traits:["智商在线，学开门、开抽屉都是基本操作","好奇心爆棚，什么都要亲自验证一下","无聊是它搞破坏的唯一原因"],
      behaviors:["把桌上的东西一样一样推下去，推完看你的反应","自己学会了开柜门，从此你家没有秘密","训练时它配合得很好——但只做三遍，第四遍它就开始自由发挥"],
      innerVsOuter:{inner:["这个杯子如果从这个角度推会怎样？","你说不行？那换个方式试试","新玩具？我赌我五分钟能破解"],outer:["优雅地一爪把杯子推下桌","被赶下桌后从另一边跳上来","叼着从益智玩具里抠出来的零食炫耀"]}
    },
    guide:{
      relationship:["给它足够的脑力挑战，无聊是一切问题的根源","跟它玩要有策略，别太容易让它赢"],
      feeding:["用漏食球、藏食拼图增加进食难度","直接放碗里太没挑战了"],
      toys:["益智玩具越难越好","定期更换，它破解速度比你买新的快","需要持续升级难度"],
      emotion:["它推东西不是在报复你，是在'做实验'","给够刺激，问题行为自然消失"]
    }},
  "ENTJ": { name:"霸道总裁喵", rarity:4, line:"这个家？谁说了算？你看看凌晨五点谁叫谁起床就知道了。", tags:["强势","掌控","领地意识"],
    monologue:"我不是霸道，我只是比你更懂这个家该怎么运转。每天五点半叫你起床是为你好，七点吃早饭是科学作息。你应该感谢我才对。",
    tips:["尊重它的领地意识，别随意改变家里布局","多猫家庭注意资源分配（食盆、猫砂盆要够）","给它'管理权'——比如固定的巡逻路线和高处观察点"],
    bubbles:["自信","果断","领导","强势","忠诚","掌控"],
    profile:{
      traits:["天生的领导者，多猫家庭里绝对的老大","对领地有很强的掌控欲，每天例行巡逻","目标感极强，想要的东西一定会得到"],
      behaviors:["凌晨准时跳到你脸上叫你起床，分秒不差","占据家里最高的位置俯瞰一切","新来的猫/人必须经过它的'审核'"],
      innerVsOuter:{inner:["五点半了，起来。这是规矩。","这个新来的必须知道谁是老大","其实…我就是想让你觉得我靠得住"],outer:["坐在你枕头上用爪子拍你的脸","堵在走廊中间不让新猫过","每天巡逻完毕回到你身边趴下"]}
    },
    guide:{
      relationship:["给它'管理权'——猫爬架最高层、固定巡逻路线","别跟它硬刚，用食物引导"],
      feeding:["固定时间固定地点，它喜欢可预测的秩序","多猫家庭分开喂"],
      toys:["需要有'目标'的游戏——捕猎模拟、追逐赛","无目的的逗弄它不感兴趣","策略型互动最合适"],
      emotion:["尊重它的领地意识","来新猫时给足隔离适应期"]
    }},
  "ESFP": { name:"气氛嗨王喵", rarity:9, line:"有你、有小鱼干、有逗猫棒——喵生如此，夫复何求。", tags:["外向","爱玩","快乐至上"],
    monologue:"生活就应该是开心的啊！你回来了，开心！有小鱼干，开心！逗猫棒在动，开心！你看我翻了个肚皮——你也开心了对不对？",
    tips:["每天至少两次互动游戏，它是快乐的永动机","注意控制体重——它太爱吃零食了","兴奋过头时帮它'刹车'，比如用食物引导它安静下来"],
    bubbles:["快乐","活泼","热闹","友善","即兴","享乐"],
    profile:{
      traits:["快乐是它的出厂设置","对所有人都友善，没有攻击性","活在当下，从不为明天的猫粮发愁"],
      behaviors:["你拿出逗猫棒的声音它在三个房间外都能听到","翻肚皮是它的日常，谁来都翻","玩到喘粗气也不肯停"],
      innerVsOuter:{inner:["逗猫棒！逗猫棒！我的最爱！","你好你好你是新朋友吗！","好累…但你还在陪我玩…再来一轮！"],outer:["从柜子顶上飞身扑下来","对着第一次来的客人翻肚皮","喘着气还在追逗猫棒"]}
    },
    guide:{
      relationship:["用互动游戏满足它旺盛的玩耍欲","每天给'安静时间'让它学会休息"],
      feeding:["严格控制零食量，它会用卖萌让你加餐","定时定量是关键"],
      toys:["逗猫棒、弹力球、纸团都是好选择","它不挑，有得玩就行","追逐型玩具最合适"],
      emotion:["兴奋过头时用零食引导安静下来","社交过后给独处时间恢复"]
    }},
  "ESFJ": { name:"甜蜜小跟班", rarity:10, line:"你上厕所关门的那一刻，我的世界崩塌了——快开门让我看看你。", tags:["黏人","分离焦虑","贴身雷达"],
    monologue:"你出门的时候我没叫，不是因为不在意，是因为怕你心疼。但门关上以后，我就趴在门口了。你鞋子上的味道，是我等你回来时唯一的安慰。",
    tips:["给稳定的生活节奏和固定仪式感","分离训练要循序渐进，从短时间开始","出门前不要大张旗鼓告别，低调离开反而更好"],
    bubbles:["忠诚","黏人","温暖","守护","稳定","陪伴"],
    profile:{
      traits:["你在哪它在哪，堪称猫界GPS","责任感超强，全家每个人它都要照顾到","喜欢稳定的生活节奏，讨厌变化"],
      behaviors:["你去厨房它跟去厨房，你去卫生间它蹲门口","你出门它趴在门口等，你回来它已经蹲在玄关了","全家人都到齐了才安心去睡觉"],
      innerVsOuter:{inner:["你要出门了…我假装不在意但我心已经碎了","门锁响了！是你吗！是你吗！","大家都在，好的，我可以安心了"],outer:["默默走到门口趴下看着你穿鞋","冲到门口喵喵叫着迎接","确认全家人到齐后才去自己的窝趴下"]}
    },
    guide:{
      relationship:["给稳定的日常仪式感（固定喂食、固定睡觉位置）","分离训练循序渐进，从短时间开始"],
      feeding:["定时定量最重要，打乱节奏它会焦虑","可以用喂食仪式增强安全感"],
      toys:["陪伴型互动为主——抚摸、一起看窗外就好","不需要太复杂的玩具","互动类玩具增进感情"],
      emotion:["出门前低调，回家后先冷静再互动","给它你的旧衣服放窝里增加安全感"]
    }},
  "ESTP": { name:"飞檐走壁侠", rarity:7, line:"那个柜子顶上我还没去过——等下，已经去过了。", tags:["冒险王","行动派","爬酷高手"],
    monologue:"你问我为什么要跳到冰箱上面？因为它在那里啊。你问我为什么从冰箱上跳到书架上？因为我能啊。人生——不对，猫生就是要不断挑战自己。",
    tips:["家里必须有足够的垂直空间（猫爬架、跳台）","危险区域要做好防护（高窗、阳台）","充足的运动量是它情绪稳定的关键"],
    bubbles:["冒险","勇敢","活力","敏捷","自由","行动"],
    profile:{
      traits:["行动力超强，想到就做","胆子大，没有不敢去的地方","对新环境适应力极强，到哪都自来熟"],
      behaviors:["能上的地方全要上去一遍——冰箱顶、柜子顶、空调上","听到异响第一个冲过去查看","第一次去新地方零恐惧，到处巡视"],
      innerVsOuter:{inner:["那个架子看着不太稳…算了先跳了再说！","外面有声音！敌情！冲啊！","这个水龙头怎么回事？让我研究研究"],outer:["一个起跳上了书架，书全掉了","箭一样射向阳台趴在窗台侦查","伸爪拨弄水龙头把自己浇了一身"]}
    },
    guide:{
      relationship:["给足垂直空间（猫爬架必备）","阳台和高窗做好安全防护"],
      feeding:["运动量大需要充足营养","可以把食物放在不同高度增加探索乐趣"],
      toys:["追逐型玩具最合适——弹力球、激光笔","适合敏捷训练","高处跳台是最好的游乐场"],
      emotion:["限制活动空间会让它焦躁","给足运动量，拆家行为自然减少"]
    }},
  "ESTJ": { name:"巡逻小队长", rarity:9, line:"说好七点吃饭就七点。迟到一分钟，我就用眼神提醒你。", tags:["守时","讲规矩","秩序维护者"],
    monologue:"七点零一分了你怎么还不喂饭？你打乱了流程你知道吗？我每天的日程表很紧的——七点吃饭，七点半巡逻，八点占窗台，八点半洗脸。你别耽误我。",
    tips:["固定作息是它最大的安全感——喂食、玩耍时间尽量别变","环境变化要给适应期，别突然大改","它的'盯着你看'不是控制，是在提醒你'该做某事了'"],
    bubbles:["纪律","可靠","严谨","忠诚","秩序","执行"],
    profile:{
      traits:["天生的规则执行者，生活有条有理","可靠稳定，是家里最让你省心的","对'该做什么不该做什么'有清晰认知"],
      behaviors:["每天固定时间催饭、固定时间巡逻、固定时间睡觉","你偏离了日常流程它会用眼神'纠正'你","新猫来了它负责制定'家规'"],
      innerVsOuter:{inner:["七点零二分了。你是不是忘了什么？","规矩就是规矩，谁违反我都有意见","日程安排好了就不要变，变了我不安心"],outer:["坐在饭碗前直勾勾盯着你","新来的猫踩了它的窝被它一爪拍走","你换了喂食时间它在旧时间点焦躁地走来走去"]}
    },
    guide:{
      relationship:["尽量保持日常节奏稳定","如果要改变什么，循序渐进"],
      feeding:["固定时间固定地点固定分量——这是它的人生信条","打乱节奏它会焦虑"],
      toys:["规则明确的互动游戏——定点、追逐、寻回","它讨厌没规律的逗弄","有章法的玩耍最合适"],
      emotion:["突然的环境变化会让它焦虑","搬家/换家具前给足过渡期"]
    }},
  "INFP": { name:"窗台小诗人", rarity:6, line:"全世界只要你就够了——其他人？不熟，谢谢。", tags:["敏感","慢热","深情"],
    monologue:"你不在的时候我会趴在你的枕头上，不是因为枕头舒服，是因为上面有你的味道。你就是我全部的安全感，你知道吗？外面的世界太吵了，我只要你就好。",
    tips:["给它一个专属安全角（窝/半封闭空间），那是它的充电站","社交不要勉强，让它按自己的节奏来","训练要温柔，大声说话会吓到它"],
    bubbles:["敏感","深情","浪漫","细腻","忠诚","温柔","内敛"],
    profile:{
      traits:["内心世界丰富，情感细腻到令人心疼","只对你（或极少数人）完全敞开心扉","对环境变化和情绪氛围极度敏感"],
      behaviors:["可以一下午坐在窗台上看外面，像在写诗","陌生人来了就消失，但你叫它名字它会偷偷探头","喜欢安静地趴在你旁边，只要你在就好"],
      innerVsOuter:{inner:["你的枕头上有你的味道，趴着就安心了","陌生人好可怕…你在吗…我要躲起来","你今天回来得晚了，我等了好久好久"],outer:["你出门后它叼着你的袜子回窝","客人还没进门它已经消失了","你回来后默默走过来蹭了蹭你的脚踝"]}
    },
    guide:{
      relationship:["减少强制社交，让它有安全的退路","给它你的旧衣服放窝里"],
      feeding:["安静环境下进食，别在旁边大声说话","可以手喂增进信任"],
      toys:["轻柔的逗猫棒、安静的嗅闻玩具","不适合太激烈的追逐游戏","柔软的陪伴型玩偶最合适"],
      emotion:["大声呵斥会让它很久才恢复","它的胆小不是缺陷，尊重它的节奏"]
    }},
  "INFJ": { name:"月光守护者", rarity:3, line:"它什么都不说，就安静地待在你身边——然后你就好了。", tags:["洞察力","安静治愈","有分寸"],
    monologue:"我不是不爱热闹，我只是更喜欢安安静静待在你身旁。你看书我趴着，你发呆我也趴着。我们之间不用说什么，在一起就很好了。但你难过的时候，我会多靠你近一点。",
    tips:["固定的作息和环境给它最大的安全感","社交以熟人为主，慢慢扩圈","它的沉默不是冷漠，是在用自己的方式表达爱"],
    bubbles:["洞察","温柔","守护","神秘","直觉","专注"],
    profile:{
      traits:["安静但洞察力极强，总能感知你的状态","有分寸感——不会过度黏人，也不会太疏远","关键时刻特别靠谱，是真正的治愈系"],
      behaviors:["总是安静地待在你附近，不吵不闹但也不远","你不开心时它会主动靠过来，比平时多蹭你两下","对陌生人保持礼貌但有距离"],
      innerVsOuter:{inner:["你难过吧？我感觉到了，我来陪你","我不说话不代表没在爱你，每一秒都在","你今天笑了三次，比昨天多一次"],outer:["默默跳上沙发紧挨着你趴下","你工作时它安静趴在桌角看着你","你笑的时候它轻轻眯了眯眼回应你"]}
    },
    guide:{
      relationship:["给它固定的'陪伴位'（你桌旁、沙发旁）","不需要特意逗它，在一起就好"],
      feeding:["安静规律的喂食环境","不喜欢被打扰进食"],
      toys:["轻柔的互动就好——羽毛逗猫棒慢慢晃","不适合太嘈杂的玩法","安静型嗅闻玩具"],
      emotion:["社交以熟人为主","它的沉默是在用它的方式爱你"]
    }},
  "INTP": { name:"纸箱哲学家", rarity:5, line:"别打扰它——它正在思考一个很重要的问题（其实是在发呆）。", tags:["独立","研究型","自有节奏"],
    monologue:"我对着那个水龙头研究了半小时不是发呆，我在分析水为什么从那里出来。你们人类不懂物理学的魅力，算了不解释了。让我再看一会儿。",
    tips:["给它独处的空间和时间，别强行互动","益智喂食器和新鲜事物能满足它的研究欲","它不理你不代表不爱你，只是在'工作'"],
    bubbles:["好奇","独立","专注","聪慧","研究","安静"],
    profile:{
      traits:["天生的研究者，对一切事物保持好奇","独立性强，享受独处的时光","学习能力强但完全按自己的节奏来"],
      behaviors:["能对着一滴水/一只虫子观察半天不动","自己玩得很开心，不需要你陪","叫它名字要叫三遍才慢悠悠看你一眼"],
      innerVsOuter:{inner:["这个水龙头的出水原理到底是什么…","你在叫我？嗯…等我研究完这个","你坐旁边就好，别说话，我在思考"],outer:["对着水龙头看了整整二十分钟","叫三遍才懒洋洋抬头看你一眼","你安静坐旁边时它反而主动蹭你"]}
    },
    guide:{
      relationship:["尊重它的独处时间","给新鲜事物激发好奇心——新纸箱、新材质的玩具"],
      feeding:["漏食球和藏食拼图比直接喂更合适","让吃饭也变成'研究'"],
      toys:["新奇的东西比贵的东西好使","需要定期换新","益智玩具、解谜类是首选"],
      emotion:["它不回应你不代表不爱你，给足自主空间","你安静陪着时它反而会主动靠近"]
    }},
  "INTJ": { name:"高冷审判官", rarity:4, line:"看似不需要你，其实你走哪它的视线就跟到哪。", tags:["冷静","策略家","审视一切"],
    monologue:"我不是不理你，只是我觉得大惊小怪很没必要。但你晚上睡着以后，我会跳上床确认你还在——确认了，就安心了。这件事你不需要知道。",
    tips:["规则明确、边界清晰，别朝令夕改","社交别催它，给它选择权","猫爬架高处是它的'王座'，必须保留"],
    bubbles:["理性","冷静","策略","独立","自律","深沉"],
    profile:{
      traits:["冷静自持，很少有过度兴奋的时候","对环境有极强的掌控欲，什么都看在眼里","自控力强，不会为了零食丢掉尊严"],
      behaviors:["新环境先在高处观察一圈再决定下不下来","你回家它只抬眼看一下又闭上了，但其实一直在听","不轻易让陌生人摸，对你偶尔才展示柔软的一面"],
      innerVsOuter:{inner:["不是不理你，是你大惊小怪没必要","你睡了吗？我去确认一下","我早就看穿一切了，只是懒得表态"],outer:["你热情叫它它只是看了你一眼","半夜偷偷跳上床蹭了你一下又跳走","新来的客人伸手摸它被它一个侧身闪开"]}
    },
    guide:{
      relationship:["规则明确别变来变去","别强行抱它，等它主动来找你"],
      feeding:["不贪食但对品质有要求","固定时间放好即可，别盯着它吃"],
      toys:["高难度益智玩具才配得上它","策略型藏食游戏","不喜欢无意义的重复"],
      emotion:["它的高冷是性格不是不爱你","半夜来蹭你就是它最大的表白"]
    }},
  "ISFP": { name:"阳光躺平喵", rarity:7, line:"阳光、软垫、你的腿——这是我的完美三件套。", tags:["温柔","享受型","审美在线"],
    monologue:"阳光刚好照到那块垫子上，温度也刚刚好。这就是完美的午后。你要是能来摸摸我的下巴那就更完美了。对了你新换的那个猫砂我不太喜欢，就这样。",
    tips:["环境舒适度是第一要务——垫子要软、窝要暖、光线要好","训练用鼓励替代压力，温柔引导","尊重它的挑剔，那是在告诉你它的需求"],
    bubbles:["温柔","细腻","享受","惬意","审美","安静","自在"],
    profile:{
      traits:["温柔到骨子里，对舒适度有极高要求","慢热但一旦亲近就特别黏人","有自己的审美，挑剔但可爱"],
      behaviors:["会在家里试遍每个角落，找到最舒服的那一个","阳光好的时候在窗边一趴就是一下午","你摸它的姿势不对它会扭开，姿势对了才肯咕噜"],
      innerVsOuter:{inner:["这个垫子不够软，下一个","阳光刚好照到我身上…完美，别动","你摸的位置不对…往左边一点…对了"],outer:["试了三个位置才选定今天的窝点","在窗边阳光里趴了一整个下午","你摸右边它扭开，你摸左边它开始咕噜"]}
    },
    guide:{
      relationship:["环境舒适是一切的基础——温度、垫子、噪音都会影响它","训练用鼓励替代压力，温柔引导"],
      feeding:["对食物品质挑剔，可能需要换几种才找到最爱","进食环境要安静"],
      toys:["轻柔的逗猫棒、羽毛玩具","节奏慢一点，别太激烈","柔软的垫子和玩偶"],
      emotion:["它的挑剔是在表达需求","给足舒适感，它会回报你最温柔的咕噜"]
    }},
  "ISFJ": { name:"安静小影子", rarity:10, line:"不争不抢，只想守着你到最后一刻。", tags:["安静","忠诚","岁月静好"],
    monologue:"你关门出去的时候我没叫，因为怕你心疼。但门关上以后我就趴在玄关了。你的脚步声，是我每天最期待的声音。你不知道而已。",
    tips:["规律的陪伴是它最大的安全感","分离训练要循序渐进，别一下子离开太久","多做轻柔的肢体接触——抚摸、梳毛就是最好的互动"],
    bubbles:["温暖","贴心","忠诚","稳定","守护","安心"],
    profile:{
      traits:["天生的暖心小棉袄，最会'安静地爱你'","不争不抢，性格稳定让你格外安心","对你有极深的依恋，但表达方式很克制"],
      behaviors:["永远在你附近但不吵闹——你在书桌它在脚边","你生病时它会格外安静地陪着你","多猫家庭里它不争食不争位，默默退让"],
      innerVsOuter:{inner:["你要出门了…没关系…我等你","你回来了…太好了太好了太好了","别的猫抢走了我的位置…算了我让给它吧"],outer:["安静地蹲在门口看你穿鞋","慢慢走过来蹭了蹭你的脚踝","默默让出窝去角落趴下"]}
    },
    guide:{
      relationship:["规律的陪伴节奏——每天固定抚摸时间","多猫家庭要给它专属空间"],
      feeding:["定时定量配合温柔语气","多猫家庭确保它能安心吃到饭"],
      toys:["轻柔互动为主——抚摸、梳毛、轻轻晃逗猫棒","不需要太复杂","陪伴型玩偶给它安全感"],
      emotion:["分离训练循序渐进","给它你的旧衣物增加安全感"]
    }},
  "ISTP": { name:"独行侠客喵", rarity:5, line:"独来独往不是不爱你——只是爱得很酷。", tags:["独立","冷静","旁观者"],
    monologue:"我知道你觉得我不够热情。但你淋着雨回来那天，我虽然只是看了你一眼，心里想的是：'回来就好。' 然后我又趴下了——因为我确认你没事了。",
    tips:["给足独处空间，别一直抱着不放","它不黏你不代表不爱你——半夜偷偷靠过来就是证据","社交少而精，不要安排太多刺激"],
    bubbles:["独立","冷静","自在","观察","理性","沉稳"],
    profile:{
      traits:["独立性极强，享受自己的空间和节奏","冷静理性，不轻易被外界干扰","观察力敏锐，什么都看在眼里但不说"],
      behaviors:["喜欢找个安静的角落自己待着","不需要你一直陪，但你叫它时它会看你一眼（不一定过来）","偶尔突然蹭你一下，蹭完就走"],
      innerVsOuter:{inner:["我自己待着挺好的，你不用管我","你回来了…嗯，挺好","其实…偶尔被你摸一下还挺舒服的"],outer:["在角落趴了一整天，谁叫都不动","你进门它抬头看了一眼又继续趴着","路过你时突然蹭了你一下然后继续走"]}
    },
    guide:{
      relationship:["给足空间，别追着它抱","它主动来找你的时候好好回应"],
      feeding:["安静独立的进食空间","不喜欢被盯着吃饭"],
      toys:["独自能玩的玩具最合适——球、弹簧鼠","互动时保持'冷酷'风格，别太热情","不需要太多社交互动"],
      emotion:["它的'独处'是充电不是冷战","偶尔的蹭蹭就是它最大的告白"]
    }},
  "ISTJ": { name:"准时闹钟喵", rarity:8, line:"稳、准、靠谱——按规矩来，它最舒服。", tags:["规律达人","守序","省心"],
    monologue:"早上六点半准时叫你起床不是因为我饿了——好吧也是因为饿了。但更重要的是你昨天也是六点半喂的，前天也是。既然形成了规矩，就一天也不能差。",
    tips:["固定规则+固定节奏是它的人生信条","环境变化要给充足的适应期","它的'催促'不是烦人，是在执行它认定的规则"],
    bubbles:["稳重","可靠","规律","踏实","自律","坚定"],
    profile:{
      traits:["稳定可靠是它最大的标签","对规则和秩序有天生的尊重","低波动的情绪让你格外安心"],
      behaviors:["每天同一时间叫你起床，误差不超过五分钟","固定在同一个位置睡觉，同一个位置吃饭","不会突然发疯或做出出格的事——行为高度可预测"],
      innerVsOuter:{inner:["六点半了，该起了。这是规矩。","今天的流程跟昨天一样，很好","虽然日子重复，但每天有你就很好"],outer:["准时跳上床，拍你的脸","吃完饭去窗台趴着，跟昨天一模一样","每天晚上固定时间走到你身边趴下"]}
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

const dimLabels = { EI:'社交能量', SN:'感知方式', TF:'决策偏好', JP:'生活方式' };
const dimEmoji = { EI:'💬', SN:'👀', TF:'🧠', JP:'📋' };

function renderQuestion(animate){
  const q = questions[idx];
  trackEvent('funnel', 'question_reached', 'q' + (idx + 1), idx + 1);
  const panel = document.getElementById("panel");
  if(panel) panel.classList.remove("panel-result");
  const pct = Math.round(((idx)/questions.length)*100);
  document.getElementById("step").innerText = "题目进度";
  document.getElementById("progress").innerText = `${idx+1}/${questions.length}`;
  setBar((idx)/questions.length);

  const dimClass = q.dim.toLowerCase();
  const dimLabel = dimLabels[q.dim] || '';
  const dimEm = dimEmoji[q.dim] || '';

  document.getElementById("content").innerHTML = `
    <div class="quiz-card ${animate ? 'quiz-enter' : ''}">
      <div class="dim-badge ${dimClass}">${dimEm} ${dimLabel}</div>
      <div class="q">${q.q}</div>
      <button class="opt" id="optA" onclick="choose('A')">A. ${q.A}</button>
      <button class="opt" id="optB" onclick="choose('B')">B. ${q.B}</button>
      <div class="progress-text">${pct}% 已完成 · 还剩 ${questions.length - idx} 题</div>
    </div>
  `;
}


function choose(which){
  if(isTransitioning) return;
  isTransitioning = true;

  const q = questions[idx];
  const s = (which === "A") ? q.scoreA : q.scoreB;
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
          { text: "正在解读 TA 的内心世界...", sub: "综合 " + questions.length + " 道题目深度分析" },
          { text: "正在匹配性格档案...", sub: "在 16 种性格中寻找 TA 的位置" },
          { text: "报告生成中...", sub: "即将揭晓 TA 的隐藏人格 ✨" }
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
      <div class="avatar-prompt-title">🎉 分析完成！</div>
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
        上传你家猫主子的照片<br/>让结果卡更有专属感 ✨
      </div>
      <button class="avatar-prompt-btn" id="avatarPromptBtn" onclick="avatarPromptContinue()">上传照片，生成专属卡</button>
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
    { left:'E 外向', right:'内向 I', lKey:'E', rKey:'I', lColor:'#FF6B81', rColor:'#C4A6FF', label:'社交能量' },
    { left:'S 实感', right:'直觉 N', lKey:'S', rKey:'N', lColor:'#FFB074', rColor:'#8CC8FF', label:'感知方式' },
    { left:'T 理性', right:'感性 F', lKey:'T', rKey:'F', lColor:'#7ED9A6', rColor:'#FFD666', label:'决策偏好' },
    { left:'J 计划', right:'随性 P', lKey:'J', rKey:'P', lColor:'#FF6B81', rColor:'#7ED9A6', label:'生活方式' },
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
    { left:'E', right:'I', lKey:'E', rKey:'I', lColor:'#FF6B81', rColor:'#C4A6FF' },
    { left:'S', right:'N', lKey:'S', rKey:'N', lColor:'#FFB074', rColor:'#8CC8FF' },
    { left:'T', right:'F', lKey:'T', rKey:'F', lColor:'#7ED9A6', rColor:'#FFD666' },
    { left:'J', right:'P', lKey:'J', rKey:'P', lColor:'#FF6B81', rColor:'#7ED9A6' },
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
        <div class="result-title">测试结果</div>

        <div class="avatar-wrap">
            <div class="avatar-circle" style="border-color:${typeColors[type]||'#FF6B81'}" onclick="clickAvatar()">
                <img id="avatarImg" alt="头像" />
                <div class="avatar-camera-badge">📷</div>
            </div>
            <input id="avatarInput" type="file" accept="image/*" style="display:none" onchange="handleAvatarChange(event)" />
        </div>

        <div class="result-type" style="color:${typeColors[type]||'#FF6B81'}">${type}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-line">"${r.line}"</div>
        <div class="result-rarity">🐱 你家猫主子属于 ${type} 型，仅占所有测试猫咪的 ${r.rarity}%</div>

        <div class="result-tags">${tagsHtml}</div>

        <!-- 维度条形图（免费展示） -->
        <div class="dim-section">
          <div class="section-title">维度分析</div>
          ${dimHtml}
        </div>

        <!-- 内心独白（免费展示） -->
        <div class="monologue-card">
          <div class="monologue-label">TA的内心独白</div>
          <div class="monologue-text">"${r.monologue}"</div>
        </div>

        <!-- 心理 vs 外在（免费展示） -->
        <div class="vs-card">
          <div class="sub-title" style="font-size:15px;font-weight:800;color:#2D2A26;margin-bottom:12px;">🎭 心理想的 vs 外表表现的</div>
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

        <!-- ===== 解锁分割线 ===== -->
        <div class="lock-divider">
          <div class="lock-divider-line"></div>
          <div class="lock-divider-text">🔒 以下为完整报告内容</div>
          <div class="lock-divider-line"></div>
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

        <!-- 🔒 详细性格画像（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="profile-section">
              <div class="section-title">性格画像</div>
              <div class="profile-card">
                <div class="sub-title">✨ 代表特点</div>
                <ul>${persona.traitsHtml}</ul>
              </div>
              <div class="profile-card">
                <div class="sub-title">🐾 行为表现</div>
                <ul>${persona.behaviorsHtml}</ul>
              </div>
            </div>
          </div>
        </div>

        <!-- 🔒 主人指南（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
            <div class="guide-section">
              <div class="section-title">主人指南</div>
              <div class="tips-card" style="margin-bottom:14px;">
                <div class="sub-title">⚡ 快速要点</div>
                <ul>${tipsHtml}</ul>
              </div>
              ${guideHtml}
            </div>
          </div>
        </div>

        <div class="hr"></div>

        <!-- 海报卡（豪华版）：9:16长图 540x960 -->
        <div id="resultCard" class="poster">
          <div class="poster-brand">萌宠联萌 · 猫咪MBTI</div>
          <div class="p-avatar"><img id="avatarImgPoster" alt="头像" /></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${type}</div>
          <div class="p-name">${r.name}</div>
          <div class="p-line">"${r.line}"</div>
          <div class="p-rarity">🐾 仅占所有测试猫咪的 ${r.rarity}%</div>
          <div class="p-monologue">"${r.monologue.length > 30 ? r.monologue.substring(0, 30) + '...' : r.monologue}"</div>
          <div class="p-tags">${r.tags.map(t=>'<span class="p-tag">'+t+'</span>').join('')}</div>
          <div class="p-section-title">它的情绪泡泡</div>
          <div class="p-bubbles">${posterBubblesHtml}</div>
          <div class="p-section-title">维度分析</div>
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
          <div class="poster-brand">萌宠联萌 · 猫咪MBTI</div>
          <div class="pf-spacer-top"></div>
          <div class="p-avatar"><img id="avatarImgPosterFree" alt="头像" /></div>
          <div class="pf-spacer"></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${type}</div>
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
            <div class="pf-unlock-sub">含情绪泡泡 · 维度分析 · 主人指南</div>
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
          <button class="btn-primary" id="posterBtn" onclick="handleGeneratePoster()">生成结果图</button>
        </div>

        <div class="btns">
          <button class="btn-ghost" onclick="start()">重新测试</button>
        </div>

        <div class="community-card">
          <div style="font-weight:900; color:var(--pri); font-size:15px; margin-bottom:4px;">🎁 免费领取专属养护手册</div>
          <div class="muted" style="font-size:12px; margin-bottom:12px;">加企微领取养护手册 + 进同品种同性格交流群</div>
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
  if(typeLabel) typeLabel.innerText = finalType || "猫咪性格";
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
  btn.textContent = isUnlocked ? '✨ 生成专属海报' : '生成结果图';
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
        <div class="remind-text"><strong>上传 TA 的照片，海报更有专属感</strong><br/>一张有你家猫主子头像的海报才值得晒</div>
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
      a.download = `猫咪MBTI-${finalType || "RESULT"}.png`;
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

