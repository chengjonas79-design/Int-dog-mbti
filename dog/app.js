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
        pet: 'dog',
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
const AVATAR_KEY = "dog_mbti_avatar";
const DEFAULT_AVATAR = "touxiang.png.jpg";
const UNLOCK_KEY = "dog_mbti_unlocked";              // 解锁状态存储键
let unlockCountdownTimer = null;                     // 倒计时定时器

// 16种类型专属主题色（轻量点缀：类型大字+头像边框）
const typeColors = {
  ENFP:'#FF8C42', ENFJ:'#FF6B8A', ENTP:'#5CB8FF', ENTJ:'#C94040',
  ESFP:'#FFB627', ESFJ:'#FF7EB3', ESTP:'#FF6542', ESTJ:'#4A7C59',
  INFP:'#B088F9', INFJ:'#6C8EBF', INTP:'#5B9A8B', INTJ:'#4A5568',
  ISFP:'#E88DB4', ISFJ:'#F4A460', ISTP:'#708090', ISTJ:'#8B7355',
};

// 16题：每个维度4题（狗子向）— 优化版：更强画面感+更口语化

// 维度：E/I, S/N, T/F, J/P
const questions = [
  // === E/I（社交能量）===
  { id:"E1", dim:"EI", q:"家里来了新客人，TA通常：", A:"尾巴摇成螺旋桨，冲过去闻个遍", B:"先远远看着，确认没危险再慢慢靠近", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E2", dim:"EI", q:"散步时遇到别的狗子，TA更像：", A:"直接凑上去，鼻子怼鼻子打招呼", B:"看了一眼，但没啥兴趣凑上去，继续走自己的", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E3", dim:"EI", q:"你加班到很晚才回家，推开门那一刻，你觉得TA内心更像：", A:"「终于！我的人回来了！」——恨不得全世界都知道这个好消息", B:"「你回来了就好」——安静地靠过来，享受只属于你们的独处时刻", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E4", dim:"EI", q:"在一个陌生的地方（比如朋友家），TA更像：", A:"越热闹越来劲，满场巡视交朋友", B:"找个角落趴着，你在旁边它才安心", scoreA:{E:1}, scoreB:{I:1}},
  { id:"E5", dim:"EI", q:"你不在家的时候，TA更可能：", A:"在门口或窗边等你，你一回来就像过年一样热情迎接", B:"自己找个舒服的地方待着，你回来了抬头看一眼就够了", scoreA:{E:1}, scoreB:{I:1}},
  // === S/N（感知方式）===
  { id:"S1", dim:"SN", q:"带TA去一个没来过的新地方，你觉得它探索世界的方式更像：", A:"踏实的记录者——每个角落都要亲自确认，不放过任何细节", B:"天生的冒险家——直觉告诉它哪里最有趣，直接冲过去", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S2", dim:"SN", q:"给TA一个从没见过的新玩具：", A:"先闻闻、舔舔、小心翼翼地试咬，摸索着玩", B:"直接叼起来甩、踩、扔……自创一套玩法", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S3", dim:"SN", q:"你假装扔球（其实藏在手里），TA：", A:"嗖一下冲出去找球，就算上当了下次还信", B:"看了你一眼没动，好像在说'你手里不是还攥着呢吗'", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S4", dim:"SN", q:"你觉得TA对日常生活中「小变化」的敏感程度：", A:"超强——你换双拖鞋它都要多看两眼，天生细节控", B:"基本无感——除非天塌了，否则它觉得一切都没啥变化", scoreA:{S:1}, scoreB:{N:1}},
  { id:"S5", dim:"SN", q:"教TA一个新技能（比如握手），TA更像：", A:"眼睛盯着你的手，一步步跟，重复几次就稳了", B:"自己瞎琢磨，你手还没伸出来它就开始自创动作", scoreA:{S:1}, scoreB:{N:1}},
  // === T/F（决策偏好）===
  { id:"T1", dim:"TF", q:"你严厉地对TA说'不行！'，TA更像：", A:"愣了一下，但很快该干嘛干嘛——它觉得'你说了不算'", B:"耳朵一耷，眼神变委屈，好像你伤了它的心", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T2", dim:"TF", q:"要让TA乖乖配合做不太喜欢的事（比如剪指甲），更管用的是：", A:"动作干脆利落+完事给奖励——它认结果", B:"先哄半天+语气温柔——它吃氛围", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T3", dim:"TF", q:"你心情低落窝在沙发上，TA更常：", A:"看你一眼确认没事，转头该干嘛干嘛——它觉得你过会儿就好了", B:"安静趴在你腿边，头搭上来，偶尔抬眼看看你", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T4", dim:"TF", q:"别的狗子抢了TA的玩具，TA更可能：", A:"寸步不让：我的就是我的，谢谢", B:"退一步看看你，好像在说'你管管啊'", scoreA:{T:1}, scoreB:{F:1}},
  { id:"T5", dim:"TF", q:"TA做了'坏事'被你当场抓住（比如偷吃），TA更像：", A:"淡定对视，一脸'嗯是我干的，然后呢？'", B:"你还没开口，它就耳朵一耷尾巴夹紧，满脸写着'对不起'", scoreA:{T:1}, scoreB:{F:1}},
  // === J/P（生活方式）===
  { id:"J1", dim:"JP", q:"日常作息上，TA更像：", A:"比闹钟还准：到点蹲食盆，到点趴窝", B:"随缘：有时候半夜嗨，有时候饭都懒得吃", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J2", dim:"JP", q:"如果TA会写日记，你觉得它的风格更像：", A:"井井有条型——今日计划：7点早饭→8点巡逻→18点散步 ✓", B:"想到哪写到哪——追了一片树叶…然后忘了要干嘛…哦有零食！", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J3", dim:"JP", q:"TA的一天通常是怎么度过的：", A:"有固定节奏：起床、巡逻、吃饭、散步、趴窝，跟复制粘贴似的", B:"每天都不一样：今天拆个快递，明天研究个新角落，没有规律可言", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J4", dim:"JP", q:"出门遛弯的路线换了，TA更像：", A:"有点懵：怎么不走老路了？微微不爽", B:"尾巴摇得更欢：新路=新的世界！", scoreA:{J:1}, scoreB:{P:1}},
  { id:"J5", dim:"JP", q:"TA的玩具和骨头，TA会：", A:"有固定'藏宝地点'，每次都叼回同一个角落", B:"随地一丢，下次想玩了满屋子找，还一脸无辜看你", scoreA:{J:1}, scoreB:{P:1}}
];

// 16型结果库（中文名+金句+建议+标签）
const results = {
  "ENFP": { name:"快乐永动机", rarity:8, line:"全世界都是它朋友，就是电量掉得太快。", tags:["社交达人","高兴奋","需要放电"],
    monologue:"我知道我太吵了，但看到你我就控制不住——你是我每天最期待的人啊。有时候我也会累，但只要你还愿意陪我玩，我就还能再嗨一会儿。",
    tips:["每天两次高质量放电（嗅闻+追逐）","社交要「有边界」，避免过度刺激","训练短频快，多用奖励"],
    bubbles:["热情","好奇","活力","创意","乐观","爱社交","自由"],
    profile:{
      traits:["天生社交达人，对所有人和动物都充满热情","精力充沛到让你怀疑它装了马达","情绪全写在脸上，开心就蹦跶，低落就趴窝"],
      behaviors:["见到人就兴奋摇尾巴，恨不得全世界都是朋友","玩具玩两分钟就想找新的，注意力跳跃式转移","散步时什么都想闻一闻、看一看，走走停停"],
      innerVsOuter:{inner:["好累啊…但你在笑诶，那我再嗨一会儿！","这个人好像不喜欢我…算了下一个！","我也想安静，但尾巴它不听话啊！"],outer:["明明刚趴下三秒又弹起来扑人","被冷落后立刻转头找下一个路人社交","累到打哈欠还在摇尾巴迎客"]}
    },
    guide:{
      relationship:["每天固定互动时间，满足它旺盛的社交需求","给予正面反馈和鼓励，它靠认可驱动"],
      feeding:["少量多餐，运动量大需要充足蛋白质","注意体重管理，兴奋状态下别喂零食"],
      toys:["益智类玩具轮换使用，保持新鲜感","拔河、飞盘等互动型游戏最合适","嗅闻垫和藏食游戏消耗脑力"],
      emotion:["情绪低落时多陪伴、多抚摸就好","过度兴奋时用'坐下'指令帮它冷静"]
    }},
  "ENFJ": { name:"贴心哄哄官", rarity:5, line:"你还没开口，它就知道你不开心了。", tags:["情绪感知","粘人暖心","配合度高"],
    monologue:"你以为我在撒娇，其实我在确认你开不开心。你笑了我就安心了，你叹气了我就想靠过去——因为你难过的时候，我也难过。",
    tips:["多用夸奖与抚摸建立安全感","安排稳定社交：熟人+固定场地","给它一个「陪伴岗位」（如门口迎接）"],
    bubbles:["共情","温暖","忠诚","体贴","敏锐","守护"],
    profile:{
      traits:["天生的情绪感知器，能读懂你的喜怒哀乐","喜欢照顾家里每个人，像个小管家","社交场合的氛围担当，谁都想跟它玩"],
      behaviors:["你难过时会主动靠过来蹭蹭你","家里有人吵架它会焦虑不安","出门总要确认所有家人都在才安心"],
      innerVsOuter:{inner:["你叹气了…是不是我做错了什么？","我要把全家人都照顾好，一个都不能少！","你夸我了！今天可以开心到睡着！"],outer:["你叹气时它立刻凑过来蹭你的手","家里有人没到齐就焦虑地来回走","被表扬后得意地摇尾巴炫耀一圈"]}
    },
    guide:{
      relationship:["多夸奖、多抚摸，它需要持续的正面反馈","给它一个'岗位'（如迎接、巡逻），增加价值感"],
      feeding:["定时定量，它喜欢稳定的生活节奏","可以用喂食时间做简单训练"],
      toys:["喜欢和主人一起玩的互动玩具","适合柔软的陪伴型玩偶","寻回类游戏最能让它开心"],
      emotion:["避免在它面前激烈争吵，它会内化负面情绪","分离焦虑较强，出门前给安抚仪式"]
    }},
  "ENTP": { name:"拆家鬼才", rarity:6, line:"聪明到可怕，闲着就想搞事情。", tags:["高智商","好奇心","爱挑战"],
    monologue:"你说我在拆家，但其实我在做实验。这个沙发垫到底有几层？我花了一下午终于搞清楚了。你应该表扬我才对。",
    tips:["用益智玩具/寻宝游戏消耗脑力","训练增加难度：变换场景/干扰","家里做好防咬与替代物（咬胶）"],
    bubbles:["聪明","调皮","探索","机灵","挑战","创造","大胆"],
    profile:{
      traits:["智商在线，学东西特别快但也特别会钻空子","好奇心爆棚，什么都要研究一番","精力旺盛，无聊就开始'创造性破坏'"],
      behaviors:["能自己开门、翻垃圾桶，解锁各种机关","训练时故意试探你的底线","对新事物永远保持高度兴趣"],
      innerVsOuter:{inner:["这个沙发垫有几层？我得亲自验证一下","你说不行？那我换个方法再试试！","你夸我聪明的时候我尾巴转得最快！"],outer:["沙发垫被精准拆成三层码在地上","被训斥后换了个方式继续搞破坏","解开新益智玩具后骄傲地叼来献宝"]}
    },
    guide:{
      relationship:["给它足够的脑力挑战，无聊是拆家的根源","训练时多变花样，重复太多它会罢工"],
      feeding:["用漏食球和嗅闻垫增加进食难度","藏食游戏比直接喂更能满足它"],
      toys:["益智玩具是首选，越难越好","Kong类填充玩具消磨时间","定期更换玩具保持新鲜感"],
      emotion:["它的'拆家'不是报复，是无聊的信号","给足运动和脑力消耗，问题行为自然减少"]
    }},
  "ENTJ": { name:"铁腕小队长", rarity:4, line:"别问谁是家里老大，问就是它。", tags:["强目标","执行力","主导型"],
    monologue:"我不是霸道，我只是觉得这个家需要人管，而我最适合。你别不服，想想是谁每天准时叫你起床的？",
    tips:["规则一致，口令统一（家里所有人）","用任务驱动：坐下→等待→奖励","早期社交训练避免冲突升级"],
    bubbles:["自信","果断","领导","强势","忠诚","目标"],
    profile:{
      traits:["天生领导者，家里的'老大'非它莫属","目标感极强，一旦盯上什么非达成不可","规则意识强，讨厌朝令夕改"],
      behaviors:["散步时走在前面带路，有自己的巡逻路线","对家庭成员有明确的'等级排序'","训练配合度高但前提是它认可你的权威"],
      innerVsOuter:{inner:["这个家没我管真的不行","你交给我的任务我一定完成！","其实…我就想让你觉得我靠得住"],outer:["散步时永远走在最前面带路","训练时一脸认真像个执行任务的士兵","完成指令后昂着头等你确认和表扬"]}
    },
    guide:{
      relationship:["规则一致，全家统一口令和标准","用任务驱动它：'坐下→等待→奖励'的链条最有效"],
      feeding:["固定时间固定地点，它喜欢秩序感","可以用等待指令训练进食规矩"],
      toys:["任务型玩具：寻回、定点、障碍跑","需要有'目标'的游戏才有兴趣","适合正规训练课程"],
      emotion:["尊重它的领地意识，别随意改变环境","社交冲突时先'坐下冷静'再处理"]
    }},
  "ESFP": { name:"气氛嗨王", rarity:9, line:"它的快乐简单粗暴：有人、有球、有你就够。", tags:["外向","爱玩","高互动"],
    monologue:"生活已经够累了，为什么不开心一点呢？你看我就很简单——有你、有球、有太阳，就是完美的一天。",
    tips:["多安排互动游戏：飞盘/拔河（有规则）","避免过度兴奋：玩前先坐下等待","社交后给安静休息时间"],
    bubbles:["快乐","活泼","热闹","友善","即兴","享乐"],
    profile:{
      traits:["快乐是它唯一的生活目标","对所有人都友善，没有防备心","活在当下，从不为明天发愁"],
      behaviors:["看到球就疯，看到人就摇尾巴","玩到累也不肯停，需要你帮它刹车","派对上的气氛王，谁见了都喜欢"],
      innerVsOuter:{inner:["有球！有人！今天也是满分的一天！","好累…但大家都在看我，不能停！","你笑了！所以我刚才的表演成功了！"],outer:["看到球瞬间弹射出去像装了弹簧","玩到舌头拖地还不肯回家","在狗友面前表演翻滚逗得全场大笑"]}
    },
    guide:{
      relationship:["用互动游戏满足它旺盛的社交欲","设立'安静时间'帮它学会休息"],
      feeding:["运动量大，注意补充水分和营养","避免过度兴奋时喂食，防止呛食"],
      toys:["飞盘、球类等追逐型玩具最爱","拔河绳、发声玩具也很合适","水上玩具如果它喜欢水的话"],
      emotion:["兴奋过头时用'坐下等待'帮它降温","社交后给安静空间恢复"]
    }},
  "ESFJ": { name:"贴身小尾巴", rarity:10, line:"你上厕所它蹲门口，这种爱叫ESFJ。", tags:["黏人","护家","好配合"],
    monologue:"你出门的时候我趴在门口，不是因为无聊，是因为我要确认你什么时候回来。只要门锁一响，我的尾巴就不由自主地摇了。",
    tips:["给稳定作息与固定仪式感","分离训练要循序渐进（短时离开）","多做「陪伴型任务」提升满足感"],
    bubbles:["忠诚","顾家","温暖","黏人","守护","稳定"],
    profile:{
      traits:["家就是它的全世界，家人就是它的一切","责任感超强，像个操心的老妈子","喜欢稳定规律的生活节奏"],
      behaviors:["你去哪它跟哪，上厕所也要蹲门口","家里来人会叫几声表示'我在守家'","特别在意全家人是不是都在"],
      innerVsOuter:{inner:["你要出门了…我假装没看见但心已碎","门锁响了！是你回来了吗！是吗！","全家人都在，好，我可以安心趴下了"],outer:["你拿钥匙时它默默走到门口趴下","听到开门声冲过去尾巴摇成螺旋桨","确认所有家人到齐才安心去喝水"]}
    },
    guide:{
      relationship:["给稳定的日常仪式感（固定散步、喂食时间）","分离训练循序渐进，从短时间开始"],
      feeding:["定时定量最重要，它讨厌被打乱节奏","可以用喂食仪式增强安全感"],
      toys:["陪伴型玩偶让它有安全感","互动类玩具增进亲子关系","不适合需要独自玩的复杂益智玩具"],
      emotion:["出门前不要大张旗鼓告别，低调离开","回家后先冷静再互动，避免强化焦虑"]
    }},
  "ESTP": { name:"说走就走莽撞弟", rarity:7, line:"先冲了再说——后果是什么？不重要。", tags:["行动派","胆子大","爱探索"],
    monologue:"我知道前面可能有危险，但万一有好玩的呢？人生——不对，狗生苦短，不冲一下怎么知道！",
    tips:["外出优先「嗅闻+探索」再训练","用绳控与回叫建立边界","给冲刺型运动（短跑/追逐）"],
    bubbles:["冒险","勇敢","活力","直觉","自由","行动"],
    profile:{
      traits:["行动力超强，想到就做绝不犹豫","胆子大，什么都敢尝试","对环境变化适应力极强"],
      behaviors:["散步时冲在最前面，闻到什么就追过去","对新环境零恐惧，到哪都自来熟","反应速度极快，抓球接飞盘一把好手"],
      innerVsOuter:{inner:["前面有东西！先冲了再说！","嗯…好像有点危险？算了先上再想！","那个水坑看着就很好玩啊受不了了！"],outer:["闻到啥直接拽着牵引绳狂奔","路过水坑毫不犹豫一头扎进去","第一次见猫就冲上去打招呼被挠"]}
    },
    guide:{
      relationship:["用绳控和回叫训练建立安全边界","让它先探索再训练，效果更好"],
      feeding:["高运动量需要充足营养支撑","户外训练可以用零食做回叫奖励"],
      toys:["追逐型玩具：球、飞盘最爱","嗅闻寻宝消耗它的探索欲","适合敏捷训练和障碍赛"],
      emotion:["限制自由会让它焦躁，给足户外时间","兴奋过头时用食物引导注意力回来"]
    }},
  "ESTJ": { name:"纪律小警长", rarity:9, line:"规矩就是规矩，谁来都一样。", tags:["稳定","讲规则","边界清晰"],
    monologue:"说好八点吃饭就八点，迟到一分钟我就用眼神提醒你。不是我太严格，是规矩得有人守啊。",
    tips:["训练要标准化：口令+手势固定","适合学习技巧：定点、等待、随行","社交冲突时先让它「坐下冷静」"],
    bubbles:["纪律","可靠","严谨","忠诚","秩序","执行"],
    profile:{
      traits:["天生的规则执行者，最讨厌混乱","可靠稳定，是家里最让人省心的","对'该做什么不该做什么'有清晰认知"],
      behaviors:["到点吃饭到点散步，自己就是闹钟","家里有人违规它会用眼神'提醒'你","训练一次就记住，执行力满分"],
      innerVsOuter:{inner:["已经八点零一分了你怎么还不喂饭？","规矩就是规矩，谁违反我都要管","今天的路线怎么变了？我不太安心…"],outer:["到点准时坐在饭盆前用眼神催你","家人做出格举动它会盯着看发出低哼","换了散步路线走得犹犹豫豫回头看你"]}
    },
    guide:{
      relationship:["标准化训练最适合它：固定口令+手势","规则一旦定了就别轻易改变"],
      feeding:["固定时间固定地点固定分量，完美","最适合用来做等待训练的范例"],
      toys:["定点寻回、随行训练就是最好的游戏","规则明确的互动游戏","适合学习各种高级技巧"],
      emotion:["环境突变会让它不安，提前适应","它的'盯人'是在意不是控制"]
    }},
  "INFP": { name:"玻璃心甜心", rarity:6, line:"全世界只认你一个，其他人？不熟。", tags:["敏感","依恋","慢热"],
    monologue:"你不在的时候我会趴在你的拖鞋旁边。不是因为拖鞋好闻，是因为上面有你的味道。你就是我的全部安全感，你知道吗？",
    tips:["减少强行社交，用「距离+奖励」建立信任","给安全区：窝/笼/角落","用温和训练方式，避免大声呵斥"],
    bubbles:["敏感","深情","浪漫","细腻","忠诚","温柔","内敛"],
    profile:{
      traits:["内心世界丰富，情感细腻到令人心疼","只对少数亲近的人敞开心扉","对环境变化和情绪氛围极度敏感"],
      behaviors:["在熟悉的人面前才会展现撒娇一面","陌生人靠近会躲到你身后","喜欢安静地趴在你脚边，只要你在就好"],
      innerVsOuter:{inner:["你的拖鞋上有你的味道，趴着就安心了","陌生人好可怕…你能不能抱抱我？","只要你在，全世界都是安全的"],outer:["你出门后它叼着你的拖鞋趴在窝里","陌生人靠近立刻躲到你腿后面","你坐下来它就默默贴着你的脚趴好"]}
    },
    guide:{
      relationship:["减少强行社交，用距离+奖励慢慢建立信任","给它一个专属安全区：窝/笼/角落"],
      feeding:["安静环境下进食，别在旁边大声说话","可以用手喂增进信任"],
      toys:["柔软的陪伴型玩偶最合适","嗅闻垫等安静型玩具","不适合竞争性强的互动游戏"],
      emotion:["用温和训练方式，绝对避免大声呵斥","它的胆小不是缺陷，尊重它的节奏"]
    }},
  "INFJ": { name:"治愈系影子", rarity:3, line:"它什么都不做，就待在你身边，你就好了。", tags:["观察型","粘你","有分寸"],
    monologue:"我不是不爱热闹，我只是更喜欢安安静静待在你旁边。你看书我趴着，你发呆我也趴着——我们之间不用说什么，待着就很好了。",
    tips:["固定作息与场景，安全感更强","训练用「提示→成功→奖励」；社交以熟人局为主，慢慢扩圈"],
    bubbles:["洞察","温柔","守护","神秘","直觉","专注"],
    profile:{
      traits:["安静但洞察力极强，总能感知你的状态","有分寸感，不会过度粘人也不会太疏远","关键时刻特别靠谱，是真正的守护者"],
      behaviors:["总是安静地观察周围，眼神里有故事","你不开心时它会默默陪在身边","对陌生人保持礼貌但有距离"],
      innerVsOuter:{inner:["你难过吧？我感应到了，我来陪你","我不说话不代表没在爱你，每一秒都在","你今天笑了三次，我都数着呢"],outer:["你叹气时它默默走过来趴在你脚边","安静地待在你旁边一下午纹丝不动","你开心时它也轻轻摇两下尾巴回应"]}
    },
    guide:{
      relationship:["固定作息与场景，它需要稳定的安全感","训练用'提示→成功→奖励'的正向链条"],
      feeding:["安静规律的喂食环境最重要","不喜欢被打扰进食"],
      toys:["嗅闻类安静型玩具","适合一对一的互动游戏","不适合太嘈杂的群体活动"],
      emotion:["社交以熟人局为主，慢慢扩圈","它的沉默不是冷漠，是在用自己的方式爱你"]
    }},
  "INTP": { name:"沉思小学者", rarity:5, line:"别打扰它——它正在思考一个很重要的问题（其实是发呆）。", tags:["独立","好奇","脑力型"],
    monologue:"我对着那棵树研究了半小时不是发呆，我在分析上面到底有几种味道。你们人类不懂嗅觉的学问，算了不解释了。",
    tips:["多给益智玩具、嗅闻垫、寻宝","训练加入变化，不然会无聊","用奖励建立「愿意配合」的动力"],
    bubbles:["好奇","独立","专注","聪慧","研究","安静"],
    profile:{
      traits:["天生的研究者，对一切事物保持好奇","独立性强，享受独处的时光","学习能力强但按自己的节奏来"],
      behaviors:["能对着一个东西研究半天不动","训练时有自己的'研究方式'，不一定按你说的来","独处时很自在，不会因为你不在就焦虑"],
      innerVsOuter:{inner:["这棵树上至少有四种味道，等我分析完","你在叫我？嗯…我再研究一下这个洞","你坐旁边就好，别说话，我在思考"],outer:["对着一棵树闻了整整十分钟一动不动","叫名字要叫三遍才慢悠悠抬头看你","你陪它坐着发呆时它反而主动蹭你"]}
    },
    guide:{
      relationship:["多给益智玩具满足它的研究欲","训练要加入变化，重复太多它会无聊"],
      feeding:["漏食球和嗅闻垫比直接喂更合适","让进食也变成一种'研究'"],
      toys:["益智玩具、解谜类是首选","嗅闻垫、藏食游戏","需要定期换新保持兴趣"],
      emotion:["尊重它的独处时间，别强行互动","用食物奖励建立'愿意配合'的动力"]
    }},
  "INTJ": { name:"高冷小冰块", rarity:4, line:"看似不需要你，其实你走哪它眼睛跟到哪。", tags:["冷静","策略","自控强"],
    monologue:"我不是不理你。只是我觉得大惊小怪的很没必要。但你晚上睡着以后，我会走到你床边确认你还在。确认了，我就安心了。",
    tips:["规则明确、边界清晰，少反复","训练偏「任务型」：定点/随行","社交先观察，别催，给它选择权"],
    bubbles:["理性","冷静","策略","独立","自律","深沉"],
    profile:{
      traits:["冷静自持，很少有过度兴奋的时候","心思缜密，对环境有很强的掌控欲","自控力强，不会为了零食丢了尊严"],
      behaviors:["新环境先观察一圈再决定怎么行动","训练时配合但保持'我在思考'的态度","不轻易对陌生人摇尾巴"],
      innerVsOuter:{inner:["不是不理你，是大惊小怪没必要","你睡了吗？我去床边确认一下就回来","我早就看穿一切了，只是懒得表态"],outer:["你回家它只抬头看一眼又趴下了","半夜偷偷走到你床边看你然后默默离开","新来的客人伸手摸它被它一个转身躲开"]}
    },
    guide:{
      relationship:["规则明确、边界清晰，别朝令夕改","训练偏任务型：定点、随行、复杂指令"],
      feeding:["不贪食，但对食物品质有要求","固定时间喂食即可"],
      toys:["高难度益智玩具才配得上它","策略型游戏：藏食寻宝路线","不喜欢无意义的重复游戏"],
      emotion:["社交时别催它，给它选择权","它的高冷是性格不是不爱你"]
    }},
  "ISFP": { name:"慢热小公主", rarity:7, line:"挑剔但可爱，它的舒适圈里只容得下你。", tags:["温柔","慢热","享受型"],
    monologue:"阳光、软垫、你的腿——这是我的完美三件套。别的我不太在意，舒服最重要。对了你换的那个新沐浴露我不太喜欢，就这样。",
    tips:["环境舒适最重要：温度、垫子、噪音","训练用鼓励替代压力","外出别太久，给足休息"],
    bubbles:["温柔","细腻","享受","惬意","审美","安静","自在"],
    profile:{
      traits:["温柔到骨子里，对舒适环境有很高要求","慢热但一旦亲近就特别黏人","有自己的审美和偏好，挑剔但可爱"],
      behaviors:["会挑自己喜欢的垫子和位置","不喜欢被粗暴对待，一点就够","阳光好的时候最喜欢趴在窗边晒太阳"],
      innerVsOuter:{inner:["这个垫子不够软，我拒绝趴下","阳光刚好照到我身上…完美，别动","你换了沐浴露？我闻出来了，不太行"],outer:["试了三个位置才选定今天的窝点","在窗边阳光里趴了一下午眯着眼","你伸手摸它时它挑剔地闻闻才接受"]}
    },
    guide:{
      relationship:["环境舒适是第一要务：温度、垫子、噪音","训练用鼓励替代压力，温柔引导"],
      feeding:["对食物品质挑剔，可能需要换几种找到最爱","安静舒适的进食环境"],
      toys:["柔软的玩偶和垫子","轻量级互动：慢节奏的寻物","不适合高强度运动"],
      emotion:["外出时间别太长，给足休息","它的挑剔是在告诉你它的需求"]
    }},
  "ISFJ": { name:"贴贴保姆汪", rarity:10, line:"不争不抢，就想守着你到最后一刻。", tags:["贴心","稳定","顾家"],
    monologue:"你出门的时候我没叫，因为怕你心疼。但你关门以后我就趴在门口了。你不知道，你回来开门的声音，是我一天里最好听的声音。",
    tips:["适合规律陪伴：固定散步时间","做分离训练避免依赖过强","用轻松互动（抚摸/舔食）安抚"],
    bubbles:["温暖","贴心","忠诚","稳定","守护","安心"],
    profile:{
      traits:["天生的暖心小棉袄，最会照顾人","不争不抢，性格稳定让人安心","对主人有极深的依恋和忠诚"],
      behaviors:["永远跟在你脚边，走到哪跟到哪","你生病时会格外温柔地陪着你","不跟别的狗子争玩具，自己默默退让"],
      innerVsOuter:{inner:["你关门的声音是我一天里最怕听到的","没事我不叫，怕你心疼…但我会等你","你摸别的狗了？没关系…我不争的"],outer:["你出门后它默默趴在门口一动不动","从不争抢玩具被抢了就安静退到一边","你回家开门瞬间它已经摇着尾巴等好了"]}
    },
    guide:{
      relationship:["规律的陪伴节奏最重要：固定散步时间","适度分离训练，避免过度依赖"],
      feeding:["用喂食时间做简单互动训练","定时定量，配合温柔的语气"],
      toys:["轻松互动型：抚摸、舔食垫","不需要太复杂的玩具","陪伴型玩偶给它安全感"],
      emotion:["分离训练要循序渐进，别一下子离开太久","多做轻松的肢体接触（抚摸、拥抱）"]
    }},
  "ISTP": { name:"佛系酷盖", rarity:5, line:"独来独往不是不爱你，只是爱得很酷。", tags:["独立","冷静","观察"],
    monologue:"我知道你觉得我不够热情。但下雨天你淋着回来，我虽然只是抬头看了你一眼，心里想的是：'回来就好。'",
    tips:["给空间：别一直抱、别强互动","训练用「少说多做」：动作明确","社交少而精，避免过度消耗"],
    bubbles:["独立","冷静","自在","观察","理性","沉稳"],
    profile:{
      traits:["独立性极强，享受自己的空间和节奏","冷静理性，不轻易被外界干扰","观察力敏锐，什么都看在眼里"],
      behaviors:["喜欢找个安静的角落自己待着","不需要你一直陪，但你叫它时会来","对环境变化看似不在意但其实都注意到了"],
      innerVsOuter:{inner:["我自己待着挺好的，你别太担心","下雨天你回来了…嗯，回来就好","我不是不爱你，我就是酷着爱你"],outer:["自己找了个角落趴着谁叫都不动","你淋雨回家它只抬头看了你一眼就继续趴","偶尔散步时突然靠过来蹭你一下又走开"]}
    },
    guide:{
      relationship:["给足空间，别一直抱着不放","训练用'少说多做'：动作明确，废话少说"],
      feeding:["安静独立的进食空间","不喜欢被盯着吃饭"],
      toys:["独自能玩的玩具最合适","嗅闻垫、Kong填充玩具","不需要太多社交互动"],
      emotion:["社交安排少而精，避免过度消耗","尊重它的'独处时间'，那是它的充电方式"]
    }},
  "ISTJ": { name:"稳重老干部", rarity:8, line:"稳、准、靠谱：按规矩来它最舒服。", tags:["稳重","守规则","低波动"],
    monologue:"早上六点半准时起来不是因为我勤快，是因为你昨天说好了六点半。既然说好了，那就得执行，一天也不能差。",
    tips:["固定规则+固定路线，最省心","训练重「重复与一致性」","适合做基础服从：等待/随行/回叫"],
    bubbles:["稳重","可靠","规律","踏实","自律","坚定"],
    profile:{
      traits:["稳定可靠是它最大的标签","对规则和秩序有天生的尊重","低波动的情绪让你格外安心"],
      behaviors:["每天走同一条路线，去同一个地方","训练指令执行得一丝不苟","不会突然发疯或做出出格的事"],
      innerVsOuter:{inner:["六点半了该起了，说好的不能差一天","今天走左边那条路，跟昨天一样才对","虽然日子重复，但每天有你就很好"],outer:["每天准时在门口等你回家误差不超一分钟","散步永远走同一条路线同一个方向","你加班晚归它趴在门口等到打瞌睡也不挪窝"]}
    },
    guide:{
      relationship:["固定规则+固定路线，是它最省心的模式","训练重'重复与一致性'，它会越练越好"],
      feeding:["固定时间固定地点，永远不会出问题","最适合培养良好进食习惯"],
      toys:["基础服从训练就是最好的'游戏'","寻回、随行、等待等经典项目","不需要太花哨的玩具"],
      emotion:["不要突然改变它的生活节奏","环境变化时提前适应，给它过渡期"]
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

  const backBtn = idx > 0 ? `<button class="back-btn" onclick="goBack()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>上一题</button>` : '';

  document.getElementById("content").innerHTML = `
    <div class="quiz-card ${animate ? 'quiz-enter' : ''}">
      <div class="dim-badge ${dimClass}">${dimEm} ${dimLabel}</div>
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
  E: "据说这种狗子在群里最受欢迎😆",
  I: "外冷内热的小甜心就是它吧✨",
  S: "稳重可靠的家庭小卫士🐶",
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
        上传你家狗子的照片<br/>让结果卡更有专属感 ✨
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
        <div class="rarity-card">
          <div class="rarity-badge ${r.rarity <= 4 ? 'rarity-ssr' : r.rarity <= 6 ? 'rarity-sr' : 'rarity-r'}">${r.rarity <= 4 ? 'SSR' : r.rarity <= 6 ? 'SR' : 'R'}</div>
          <div class="rarity-text">全国仅 <strong>${r.rarity}%</strong> 的狗子是这个类型</div>
        </div>

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

        <!-- ===== 解锁分割线 ===== -->
        <div class="lock-divider">
          <div class="lock-divider-line"></div>
          <div class="lock-divider-text">🔒 TA还有这些秘密你不知道</div>
          <div class="lock-divider-line"></div>
        </div>

        <!-- 预览钩子：露出第一条性格特点 -->
        <div class="unlock-teaser" onclick="showUnlockModal()">
          <div class="teaser-trait">✨ ${(r.profile?.traits||[])[0] || ''}</div>
          <div class="teaser-more">还有更多关于 TA 的秘密... 🔓 免费解锁查看</div>
        </div>

        <!-- 🔒 心理 vs 外在（加遮罩） -->
        <div class="locked-section">
          <div class="lock-overlay" onclick="showUnlockModal()">
            <div class="lock-icon">🔒</div>
            <div class="lock-text">加企微免费解锁</div>
          </div>
          <div class="lock-content">
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
          <div class="poster-brand">萌宠联萌 · 狗狗MBTI</div>
          <div class="p-avatar"><img id="avatarImgPoster" alt="头像" /></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${type}</div>
          <div class="p-name">${r.name}</div>
          <div class="p-line">"${r.line}"</div>
          <div class="p-rarity">🐾 仅占所有测试狗狗的 ${r.rarity}%</div>
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
          <div class="poster-brand">萌宠联萌 · 狗狗MBTI</div>
          <div class="pf-spacer-top"></div>
          <div class="p-avatar"><img id="avatarImgPosterFree" alt="头像" /></div>
          <div class="pf-spacer"></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${type}</div>
          <div class="p-name">${r.name}</div>
          <div class="pf-spacer"></div>
          <div class="p-line">"${r.line}"</div>
          <div class="pf-spacer-sm"></div>
          <div class="p-rarity">🐾 仅占所有测试狗狗的 ${r.rarity}%</div>
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
          <button class="btn-share" onclick="copyShareText()">一键复制晒圈文案</button>
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
  if(typeLabel) typeLabel.innerText = finalType || "狗子性格";
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
  const validUrl = url.startsWith('http') ? url : 'https://www.mclmpet.com/dog/'; // 兜底线上地址

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
  const text = `我家狗子是${finalType}「${r.name}」！${r.line}\n${rarityTag ? rarityTag + '！' : ''}全国仅${r.rarity}%的狗子是这个类型～\n你家汪星人是什么性格？来测测👉 www.mclmpet.com`;
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
        <div class="remind-text"><strong>上传 TA 的照片，海报更有专属感</strong><br/>一张有你家狗子头像的海报才值得晒</div>
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
      a.download = `狗狗MBTI-${finalType || "RESULT"}.png`;
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

