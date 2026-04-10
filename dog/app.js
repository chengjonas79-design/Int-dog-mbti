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

// SBTI 梗代号映射（MBTI→宠物SBTI代号）
const typeCodeMap = {
  ENFP:'HYPE', ENFJ:'CARE', ENTP:'BOOM', ENTJ:'BOSS',
  ESFP:'WILD', ESFJ:'GLUE', ESTP:'YOLO', ESTJ:'COP!',
  INFP:'EMO!', INFJ:'HEAL', INTP:'ZONE', INTJ:'COLD',
  ISFP:'DIVA', ISFJ:'SIMP', ISTP:'CHILL', ISTJ:'TICK'
};

// 16种类型专属主题色（轻量点缀：类型大字+头像边框）
const typeColors = {
  ENFP:'#FF8C42', ENFJ:'#FF6B8A', ENTP:'#5CB8FF', ENTJ:'#C94040',
  ESFP:'#FFB627', ESFJ:'#FF7EB3', ESTP:'#FF6542', ESTJ:'#4A7C59',
  INFP:'#B088F9', INFJ:'#6C8EBF', INTP:'#5B9A8B', INTJ:'#4A5568',
  ISFP:'#E88DB4', ISFJ:'#F4A460', ISTP:'#708090', ISTJ:'#8B7355',
};

// 20题：四维度交叉排列，暴论风格，沉浸式答题
const questions = [
  {id:"E1",dim:"EI",q:"有不明人类闯入领地（家里来客人了），TA的安保级别：",A:"零级——不仅不拦，还冲上去验货，尾巴摇得差点起飞",B:"最高级——先远远侦察，确认来者不是刺客才慢慢靠近",scoreA:{E:1},scoreB:{I:1}},
  {id:"S1",dim:"SN",q:"解锁新地图（带TA去没去过的地方），TA的探索策略：",A:"稳扎稳打逐格扫描——每个角落都要闻到、确认、存档",B:"凭直觉选方向直接冲——攻略是什么？能吃吗？",scoreA:{S:1},scoreB:{N:1}},
  {id:"T1",dim:"TF",q:"你深吸一口气，酝酿了三分钟的气势，用你人生中最威严的声音说了一个字——「不！」结果：",A:"它愣了一下，然后该干嘛干嘛。你的三分钟白酝酿了",B:"它耳朵一耷，眼神比你分手时还委屈——然后你开始道歉了",scoreA:{T:1},scoreB:{F:1}},
  {id:"J1",dim:"JP",q:"TA的生物钟精确程度：",A:"比闹钟还准——到点蹲食盆，误差不超过30秒",B:"完全随机——有时半夜发疯，有时饭都懒得吃",scoreA:{J:1},scoreB:{P:1}},
  {id:"E2",dim:"EI",q:"路上偶遇同类，TA的社交模式：",A:"鼻子直接怼脸——「你好我们已经是朋友了」",B:"瞄一眼就走——「我们不熟，保持距离谢谢」",scoreA:{E:1},scoreB:{I:1}},
  {id:"T2",dim:"TF",q:"要让它配合剪指甲这种酷刑，哪招更管用？",A:"快准狠+完事给零食——它认交易",B:"先哄半天+温柔说话——它吃情绪价值",scoreA:{T:1},scoreB:{F:1}},
  {id:"S2",dim:"SN",q:"获得一个来历不明的新玩具，TA的鉴定流程：",A:"先闻、再舔、小心试咬——标准验货程序",B:"叼起来甩飞踩扁——管它是啥先拆了再说",scoreA:{S:1},scoreB:{N:1}},
  {id:"J2",dim:"JP",q:"如果TA有朋友圈，它的画风更接近：",A:"「今日计划✓：7点早饭→8点巡逻→18点散步」高度自律",B:"「追了一片树叶…然后忘了要干嘛…哦有零食！」混乱中带着快乐",scoreA:{J:1},scoreB:{P:1}},
  {id:"E3",dim:"EI",q:"你终于拖着社畜的躯壳回来了，TA的反应：",A:"「我的人！终于！」恨不得全小区都知道你回来了",B:"安静靠过来蹭蹭你——「回来就好，别大惊小怪的」",scoreA:{E:1},scoreB:{I:1}},
  {id:"S3",dim:"SN",q:"你使出经典骗术——假装扔球其实藏手里：",A:"嗖一下冲出去找——就算上当八百次，第八百零一次还信",B:"看了你一眼没动——「你手里攥着呢，当我傻？」",scoreA:{S:1},scoreB:{N:1}},
  {id:"J3",dim:"JP",q:"如果有人把TA的一天拍成纪录片：",A:"《重复的艺术》——起床、巡逻、吃饭、散步、趴窝，跟昨天一模一样",B:"《混沌日记》——今天拆了个快递，明天追了只蝴蝶，没人知道下一集演什么",scoreA:{J:1},scoreB:{P:1}},
  {id:"T3",dim:"TF",q:"你被生活暴打了一顿，瘫在沙发上怀疑人生。TA看了你一眼：",A:"确认你没死，转头继续自己的事——「你会好的，我先睡了」",B:"默默趴到你腿边把头搭上来——虽然它完全不知道发生了什么",scoreA:{T:1},scoreB:{F:1}},
  {id:"E4",dim:"EI",q:"此题由你家毛孩子出题：「主人带我去陌生地方，我的第一反应是」",A:"太好了！新朋友！新味道！全场我最闪亮！",B:"我要回家。这里每一个人和每一只狗都让我不安。",scoreA:{E:1},scoreB:{I:1}},
  {id:"S4",dim:"SN",q:"你偷偷换了双拖鞋，TA的反应级别：",A:"立刻锁定目标多看两眼——「这什么新物种？需要调查」",B:"完全无感——就算你把家搬了它可能也不会发现",scoreA:{S:1},scoreB:{N:1}},
  {id:"T4",dim:"TF",q:"领地被侵犯——有狗抢了它的玩具：",A:"寸步不让——「我的东西，碰一下试试？」",B:"委屈巴巴看着你——「你是我的靠山，你管管啊」",scoreA:{T:1},scoreB:{F:1}},
  {id:"J4",dim:"JP",q:"你换了一条遛弯路线，TA的接受度：",A:"「怎么不走老路？」微微不爽，仿佛你动了它的奶酪",B:"尾巴摇更欢——「新世界！新味道！冲！」",scoreA:{J:1},scoreB:{P:1}},
  {id:"E5",dim:"EI",q:"你出门后，家里的监控大概率拍到：",A:"蹲门口盯着门锁，你一回来像过年一样蹦跶",B:"找个舒服的地方躺着，你回来了抬头看一眼就算打过招呼了",scoreA:{E:1},scoreB:{I:1}},
  {id:"S5",dim:"SN",q:"你花了一下午教它「握手」，你现在的精神状态：",A:"它学会了！天才训练师就是我！",B:"它学了个寂寞，但自创了一套你看不懂的动作",scoreA:{S:1},scoreB:{N:1}},
  {id:"T5",dim:"TF",q:"它偷吃被你当场抓获，审讯现场的表现：",A:"淡定对视——「是我干的，你能拿我怎样？」",B:"你还没开口，它已经全身写满了「对不起」——提前认罪",scoreA:{T:1},scoreB:{F:1}},
  {id:"J5",dim:"JP",q:"TA的财产管理能力：",A:"有固定藏宝点，每次都叼回同一个角落——强迫症型理财",B:"随地一丢，下次满屋子找——然后一脸无辜看你",scoreA:{J:1},scoreB:{P:1}}
];

// 16型结果库（中文名+金句+建议+标签）
const results = {
  "ENFP": { name:"社牛永动机", rarity:8, line:"全世界都是它的朋友，除了你叫它回来的时候。", tags:["社牛本牛","电量溢出","自来熟"],
    desc:"恭喜你，你家这位不是狗，是一台装了永动机芯片的社交核弹。它的交友原则只有一个：活的就行。路灯柱闻一闻算点头之交，垃圾桶蹭一蹭算莫逆之交，至于你叫它回来这件事——信号盲区，概不负责。每天出门遛它等于启动一场大型路演，它负责表演，你负责被拖着跑。",
    monologue:"我知道我太吵了。但你想想，如果我突然安静下来，你是不是反而要带我去看医生？所以其实我吵是为你好——对，你应该感谢我。等下那个人是谁？我要去认识一下。哦那只松鼠也不错，等我一下！",
    tips:["每天两次高质量放电（嗅闻+追逐）","社交要「有边界」，避免过度刺激","训练短频快，多用奖励"],
    bubbles:["人来疯","好奇宝宝","永动机","戏精","傻乐","社牛","没心没肺"],
    profile:{
      traits:["社牛到没有边界感，连路灯柱都想交个朋友","精力充沛到你怀疑它偷接了隔壁的电","情绪管理能力为零——开心就疯，不开心就趴，没有中间状态"],
      behaviors:["见到任何活物都摇尾巴——包括你邻居家那只看它不顺眼的猫","玩具保鲜期两分钟，注意力比金鱼还短","遛弯时每根电线杆都要闻，半小时走了五十米"],
      innerVsOuter:{inner:["好累…但你在笑诶！累什么累，再嗨五百年！","那个人好像不喜欢我？不可能，一定是我还不够热情！","我也想安静，但尾巴它有自己的想法啊！"],outer:["刚趴下三秒又原地复活弹射扑人","被一个人无视后0.3秒锁定下一个社交目标","累到舌头拖地了还在摇尾巴营业"]}
    },
    guide:{
      relationship:["每天固定互动时间，满足它旺盛的社交需求","给予正面反馈和鼓励，它靠认可驱动"],
      feeding:["少量多餐，运动量大需要充足蛋白质","注意体重管理，兴奋状态下别喂零食"],
      toys:["益智类玩具轮换使用，保持新鲜感","拔河、飞盘等互动型游戏最合适","嗅闻垫和藏食游戏消耗脑力"],
      emotion:["情绪低落时多陪伴、多抚摸就好","过度兴奋时用'坐下'指令帮它冷静"]
    }},
  "ENFJ": { name:"操心命", rarity:5, line:"你还没难过呢它就已经开始安慰你了。", tags:["读空气高手","操碎了心","暖到发烫"],
    desc:"你家这位不是狗，是一台高精度情绪扫描仪外加全自动安慰机。你眉头动了零点五毫米，它的焦虑警报已经拉响了。操心范围覆盖全家，从你的加班到隔壁猫的感情状态，它统统揽在自己身上。问题是它光顾着心疼别人了，自己累成狗——哦等等，它本来就是狗。",
    monologue:"你以为我在撒娇？不，我在确认你开不开心。你叹了口气对吧？我听见了。完了，我得靠过去——你不让我靠我更焦虑。你难过我比你还难过，这合理吗？不合理。但没办法，我就是这种命。",
    tips:["多用夸奖与抚摸建立安全感","安排稳定社交：熟人+固定场地","给它一个「陪伴岗位」（如门口迎接）"],
    bubbles:["老妈子","读空气","内耗","操碎心","暖宝宝","讨好型"],
    profile:{
      traits:["情绪雷达精度堪比军用设备，你皱一下眉它心率就飙了","操心范围覆盖全家老小，连门口那只流浪猫它都挂念","社交中的老好人，从来不得罪任何人——累不累啊你"],
      behaviors:["你还没开口叹气它已经贴过来了——你怀疑它读心","家里有人吵架它比当事人还焦虑，来回踱步像联合国调解员","每次出门它都清点人数，少一个就原地焦虑到转圈"],
      innerVsOuter:{inner:["你叹气了…完了完了是不是我做错了什么？我反思一下","全家人必须整整齐齐！一个不能少！我说的！","你夸我了！！今晚可以做个好梦了！！"],outer:["你叹气0.5秒它已经把头拱到你手底下了","有人没到家就焦虑地在门口和窗口来回巡逻","被表扬后兴奋得原地转圈恨不得全小区都知道"]}
    },
    guide:{
      relationship:["多夸奖、多抚摸，它需要持续的正面反馈","给它一个'岗位'（如迎接、巡逻），增加价值感"],
      feeding:["定时定量，它喜欢稳定的生活节奏","可以用喂食时间做简单训练"],
      toys:["喜欢和主人一起玩的互动玩具","适合柔软的陪伴型玩偶","寻回类游戏最能让它开心"],
      emotion:["避免在它面前激烈争吵，它会内化负面情绪","分离焦虑较强，出门前给安抚仪式"]
    }},
  "ENTP": { name:"拆迁办主任", rarity:6, line:"上班摸鱼你第一，拆家搞事它第一。", tags:["搞破坏天才","智商在线","闲不住"],
    desc:"你养的不是狗，是一个拿了天使轮融资的连续创业者，创业方向是拆你的家。别人家的狗咬鞋是无聊，它咬鞋是在做材料力学测试。它的智商本可以拯救世界，但它选择先把你家沙发解剖了。每次你下班回来面对一地棉花，请记住——这不是破坏现场，这是科研成果展。",
    monologue:"你说我在拆家？不不不，我在做田野调查。这沙发垫到底有几层？经过严谨的拆解实验，答案是三层。你不表扬我还骂我？行吧，反正你的拖鞋内部结构我下午也顺便研究了。你应该夸我效率高。",
    tips:["用益智玩具/寻宝游戏消耗脑力","训练增加难度：变换场景/干扰","家里做好防咬与替代物（咬胶）"],
    bubbles:["作妖","拆家","大聪明","闲不住","杠精","破坏王","皮到没边"],
    profile:{
      traits:["智商高到用来搞破坏简直是暴殄天物","好奇心强到你家没有它打不开的柜子","无聊五分钟就进入自主创业模式——创业项目：拆家"],
      behaviors:["自学成才开门翻垃圾桶，你怀疑它上辈子是小偷","训练时专门找规则漏洞——你说不许咬鞋，它就咬拖鞋","新东西到手先拆为敬，研究原理是顺便的"],
      innerVsOuter:{inner:["这沙发里面到底有几层？科学需要我亲自验证！","你说'不行'？好的我换个姿势再试一次","你夸我聪明时我尾巴转速能发电"],outer:["沙发垫被解剖成精确的三层整齐码在地上","被骂了两秒后换个房间继续搞","解开新玩具后叼过来炫耀，表情写满'就这？'"]}
    },
    guide:{
      relationship:["给它足够的脑力挑战，无聊是拆家的根源","训练时多变花样，重复太多它会罢工"],
      feeding:["用漏食球和嗅闻垫增加进食难度","藏食游戏比直接喂更能满足它"],
      toys:["益智玩具是首选，越难越好","Kong类填充玩具消磨时间","定期更换玩具保持新鲜感"],
      emotion:["它的'拆家'不是报复，是无聊的信号","给足运动和脑力消耗，问题行为自然减少"]
    }},
  "ENTJ": { name:"霸道总裁", rarity:4, line:"别问谁是家里老大，问就是它。", tags:["自带气场","管天管地","服不服"],
    desc:"你以为你养了一只狗？错了，你引进了一位空降CEO。这位总裁已经单方面宣布了家庭权力架构：它是董事长，你是前台。每天早上准时叫你起床不是因为爱你，是因为你迟到影响它的KPI。散步路线由它规划，吃饭时间由它决定，你唯一的权力是付款——而且不许延期。",
    monologue:"我不是霸道，我只是对这个家有责任感。你管这叫控制欲？那谁每天准时叫你起床？谁检查门窗有没有关好？你不感恩就算了，还说我霸道。行，今晚你的拖鞋归我管了，不服来谈。",
    tips:["规则一致，口令统一（家里所有人）","用任务驱动：坐下→等待→奖励","早期社交训练避免冲突升级"],
    bubbles:["大哥","控制欲","PUA","不服就干","卷王","服不服","气场两米八"],
    profile:{
      traits:["家里的权力结构被它单方面宣布：它是CEO你是实习生","目标感强到可怕——盯上的东西不到手不罢休，堪称狗界卷王","规则意识比你还强，你朝令夕改它第一个不答应"],
      behaviors:["散步永远走在最前面，你以为你在遛它？它在遛你","家庭成员在它心里有明确的等级排序，别问你排第几","训练时配合度极高——前提是它认可你有资格发号施令"],
      innerVsOuter:{inner:["这个家没有我管就完了，你们太不靠谱了","任务给我！我执行！别废话！","其实…我只是想让你觉得我靠得住而已啦"],outer:["散步时昂首阔步走在前面，回头看你的眼神像在视察部下","训练时一脸严肃认真，仿佛在完成国家级任务","完成指令后昂着头等表扬——不表扬就一直盯着你"]}
    },
    guide:{
      relationship:["规则一致，全家统一口令和标准","用任务驱动它：'坐下→等待→奖励'的链条最有效"],
      feeding:["固定时间固定地点，它喜欢秩序感","可以用等待指令训练进食规矩"],
      toys:["任务型玩具：寻回、定点、障碍跑","需要有'目标'的游戏才有兴趣","适合正规训练课程"],
      emotion:["尊重它的领地意识，别随意改变环境","社交冲突时先'坐下冷静'再处理"]
    }},
  "ESFP": { name:"蹦迪选手", rarity:9, line:"有人有球有你就够了，简单的快乐简单的狗。", tags:["氛围担当","快乐战士","停不下来"],
    desc:"你家这位是快乐的纯度高达百分之九十九点九的提纯物。它的人生哲学简单到令哲学家沉默：有球就追，有人就扑，有太阳就躺。脑子里没有烦恼这个选项，出厂时就被删掉了。它是狗群里的氛围担当，派对上的永动机，以及你精神状态最好的那个室友。",
    monologue:"生活够累了，为什么不开心一点？你看看我，有你、有球、有太阳，这不就是人生巅峰吗！你说不是？那你的标准也太高了吧。我觉得加个零食就是宇宙尽头了。快来跟我玩！不玩也行你看着我玩也算！",
    tips:["多安排互动游戏：飞盘/拔河（有规则）","避免过度兴奋：玩前先坐下等待","社交后给安静休息时间"],
    bubbles:["嗨皮","蹦跶","气氛组","脑子空","快乐废","嘎嘎乐","停不下来"],
    profile:{
      traits:["快乐是唯一的人生KPI，完成率常年200%","防备心为零，对全世界都敞开怀抱——你怀疑它没有杏仁核","活在当下到连下一秒要干嘛都不知道，但它不在乎"],
      behaviors:["看到球瞬间CPU过载，看到人直接社交过载，两个同时出现它就当机了","玩到四条腿都在抖了还不肯回家——你得物理搬走它","狗群社交场的氛围担当，没它在场大家都不知道怎么嗨"],
      innerVsOuter:{inner:["有球！有人！有太阳！今天又是人生巅峰！","好累…但观众还在看我呢，不能塌房！","你笑了！我的表演值了！安可安可！"],outer:["看到球弹射出去的速度能触发测速仪","玩到舌头拖地腿都软了还在摇尾巴表示'再来'","在狗友面前表演翻滚——虽然没人要求它表演"]}
    },
    guide:{
      relationship:["用互动游戏满足它旺盛的社交欲","设立'安静时间'帮它学会休息"],
      feeding:["运动量大，注意补充水分和营养","避免过度兴奋时喂食，防止呛食"],
      toys:["飞盘、球类等追逐型玩具最爱","拔河绳、发声玩具也很合适","水上玩具如果它喜欢水的话"],
      emotion:["兴奋过头时用'坐下等待'帮它降温","社交后给安静空间恢复"]
    }},
  "ESFJ": { name:"狗皮膏药", rarity:10, line:"你上厕所它蹲门口，这不是爱情是什么。", tags:["黏人精","跟屁虫","全天候待机"],
    desc:"你养的不是狗，是一块有体温会摇尾巴的创可贴。你走到哪它贴到哪，精度堪比北斗定位。你上厕所它蹲门口，你洗澡它守浴室，你出门它就启动「忠犬八公」剧本。它的分离焦虑不是病，是一种行为艺术——主题叫「没有你的每一秒都是世界末日」。全年无休，不接受调休。",
    monologue:"你出门我趴门口，不是无聊，是在执行我的人生使命。你以为我在等你？不，我在守护这个家——好吧其实就是在等你。门锁一响，尾巴已经先替我欢呼了。你迟到了三分钟，这三分钟我度日如年你知道吗？",
    tips:["给稳定作息与固定仪式感","分离训练要循序渐进（短时离开）","多做「陪伴型任务」提升满足感"],
    bubbles:["黏人精","跟屁虫","分离焦虑","守门员","恋爱脑","24h待机"],
    profile:{
      traits:["分离焦虑等级SSS——你上个厕所它都以为你移民了","责任感重到离谱，家里的事比你还上心，你就是个甩手掌柜","生活节奏一旦被打乱就进入应急状态，比你还讨厌加班"],
      behaviors:["你去哪它跟哪，上厕所蹲门口，洗澡趴浴室门口——全天候GPS定位","来客人先叫两声宣示主权：'这是我家，你注意点'","每天下班点准时趴门口——你迟到一分钟它就开始演《忠犬八公》"],
      innerVsOuter:{inner:["你拿起钥匙了……你要走了……我的天塌了……","门锁响了！！是你吗！！是你吧！！求求是你！！","全员到齐，好，我现在可以安心闭眼了"],outer:["你拿钥匙那一刻它已经趴在门口进入哀悼模式了","听到开门声冲过去，尾巴摇成螺旋桨差点起飞","数完人头确认全家到齐才肯去喝口水"]}
    },
    guide:{
      relationship:["给稳定的日常仪式感（固定散步、喂食时间）","分离训练循序渐进，从短时间开始"],
      feeding:["定时定量最重要，它讨厌被打乱节奏","可以用喂食仪式增强安全感"],
      toys:["陪伴型玩偶让它有安全感","互动类玩具增进亲子关系","不适合需要独自玩的复杂益智玩具"],
      emotion:["出门前不要大张旗鼓告别，低调离开","回家后先冷静再互动，避免强化焦虑"]
    }},
  "ESTP": { name:"莽夫", rarity:7, line:"先冲了再说，后果是什么？不重要。", tags:["行动派","莽就完了","怕啥"],
    desc:"你家这位的大脑构造很特别——负责「三思而后行」的区域出厂时就没装。它的行为模式只有一个：检测到刺激，立刻输出反应，中间不经过任何处理器。水坑看到就跳，猫看到就追，你的尖叫在它耳朵里自动翻译成「加油」。它不是勇敢，它是真的不知道什么叫怕。",
    monologue:"前面可能有危险？但万一有好玩的呢！你说让我想想？想什么想，想的时间够我跑两个来回了。狗生苦短，先冲了再说——不冲怎么知道那个水坑有多深？答案是到肚子。值了。",
    tips:["外出优先「嗅闻+探索」再训练","用绳控与回叫建立边界","给冲刺型运动（短跑/追逐）"],
    bubbles:["莽","冲就完了","不怕死","野路子","肾上腺素","送命题","鲁莽值拉满"],
    profile:{
      traits:["行动力强到脑子永远追不上腿，想到和做到之间隔了零秒","胆子大到没有天敌——直到遇到真正的天敌","适应力极强，扔到荒野它能自己建立王国"],
      behaviors:["散步时你是风筝它是风——闻到味直接拽着你狂奔","对新环境零恐惧，到哪都像回到自己家一样随便","反应速度快到离谱——接飞盘的时候像自带弹射座椅"],
      innerVsOuter:{inner:["前面有东西！不知道是啥！冲了再说！","危险？什么危险？我没看到啊——哦原来是那个，无所谓！","那个水坑在召唤我……我要回应它！"],outer:["闻到可疑气味直接暴冲，牵引绳差点把你胳膊卸了","路过水坑一头扎进去，溅你一身泥还一脸无辜","第一次见猫就冲上去社交，脸上挂了三道爪印还要再去"]}
    },
    guide:{
      relationship:["用绳控和回叫训练建立安全边界","让它先探索再训练，效果更好"],
      feeding:["高运动量需要充足营养支撑","户外训练可以用零食做回叫奖励"],
      toys:["追逐型玩具：球、飞盘最爱","嗅闻寻宝消耗它的探索欲","适合敏捷训练和障碍赛"],
      emotion:["限制自由会让它焦躁，给足户外时间","兴奋过头时用食物引导注意力回来"]
    }},
  "ESTJ": { name:"纪委书记", rarity:9, line:"规矩就是规矩，你迟到一分钟它都有意见。", tags:["规矩人","强迫症","时间管理大师"],
    desc:"恭喜你，你家来了一位自带考勤系统和绩效评估体系的纪检干部。八点吃饭就是八点，八点零一分它就启动审判程序——武器是眼神，杀伤力是良心。你换条散步路线它能用表情写出一份三千字的反对意见。它不是强迫症，它只是认为全世界都该跟它一样守规矩，包括你。尤其是你。",
    monologue:"说好八点吃饭就八点。现在八点零一分了。你迟到了。我没有生气，我只是在用眼神进行正式的书面警告。不是我太严格，是规矩得有人守——而你显然靠不住，所以我来。你说改路线？提前三个工作日报备了吗？",
    tips:["训练要标准化：口令+手势固定","适合学习技巧：定点、等待、随行","社交冲突时先让它「坐下冷静」"],
    bubbles:["强迫症","审判","时间管理","规矩人","眼神杀","纠察队","较真"],
    profile:{
      traits:["规则执行力堪比AI——不，AI都没它严格","可靠到无聊的程度，是家里唯一一个靠谱的（它自己这么认为）","对什么该做什么不该做门儿清，而且不允许任何人有异议"],
      behaviors:["到点吃饭到点散步，比你手机闹钟还准——迟到一分钟眼神能把你钉墙上","家里有人违反它制定的规矩，它会用持续的凝视进行道德审判","训练一次就记住还举一反三，执行力让你的老板都自愧不如"],
      innerVsOuter:{inner:["八点零一分了。你迟到了。你知道吗。","规矩就是规矩，天王老子来了也得守——包括你","今天路线变了？提前报备了吗？没有？那我不太接受"],outer:["到点准时坐在饭盆前，眼神像在催债","家人做了出格的事它盯着看那表情像纪检委查岗","换了散步路线它全程犹犹豫豫频频回头——'这条路没有经过审批'"]}
    },
    guide:{
      relationship:["标准化训练最适合它：固定口令+手势","规则一旦定了就别轻易改变"],
      feeding:["固定时间固定地点固定分量，完美","最适合用来做等待训练的范例"],
      toys:["定点寻回、随行训练就是最好的游戏","规则明确的互动游戏","适合学习各种高级技巧"],
      emotion:["环境突变会让它不安，提前适应","它的'盯人'是在意不是控制"]
    }},
  "INFP": { name:"emo汪", rarity:6, line:"全世界只认你一个，但你多看别的狗一眼它就碎了。", tags:["玻璃心","深情怪","认准你了"],
    desc:"你家这位的内心是一整座莎士比亚剧场，每天上演四十集悲欢离合。你就是它的全世界，坏消息是这个世界的地基是玻璃做的。你多看了别的狗一眼，地震了。你出门超过十分钟，海啸了。你回来抱它，灾后重建。它不是矫情，它是把一辈子的深情全押在你一个人身上了——赌赢了是童话，赌输了是emo。",
    monologue:"你不在的时候我趴在你拖鞋旁边——不是因为好闻，是上面有你的味道，闻着就等于你还在。你就是我全部安全感，你知道吗。你刚才摸了别的狗？没关系，我不介意。我骗你的，我很介意。我现在要去趴一会儿。别叫我。",
    tips:["减少强行社交，用「距离+奖励」建立信任","给安全区：窝/笼/角落","用温和训练方式，避免大声呵斥"],
    bubbles:["玻璃心","emo","只认你","恋爱脑","精神洁癖","碰瓷式撒娇","i人之王"],
    profile:{
      traits:["内心戏多到可以连载——你多看别的狗一眼它能心碎三天","社交圈窄到令人发指：认你、认你的拖鞋、勉强认你家沙发","对环境变化和情绪氛围的敏感度已经突破人类理解范围"],
      behaviors:["只在你面前撒娇——别人想摸它？做梦","陌生人靠近它就躲到你身后，仿佛你是防弹衣","安静趴在你脚边不动，你起身它就用'你要抛弃我吗'的眼神锁定你"],
      innerVsOuter:{inner:["你的拖鞋上有你的味道……趴着就等于你在……我没有在哭","陌生人好可怕救命你快抱我你不抱我我就要碎了","你刚才摸了别的狗……没关系……我不介意……我介意"],outer:["你出门后叼着你的拖鞋趴在窝里一动不动像个失恋现场","陌生人伸手过来它直接缩到你腿后面只露半个脑袋","你一坐下它就贴过来——你动一下它就慌一下"]}
    },
    guide:{
      relationship:["减少强行社交，用距离+奖励慢慢建立信任","给它一个专属安全区：窝/笼/角落"],
      feeding:["安静环境下进食，别在旁边大声说话","可以用手喂增进信任"],
      toys:["柔软的陪伴型玩偶最合适","嗅闻垫等安静型玩具","不适合竞争性强的互动游戏"],
      emotion:["用温和训练方式，绝对避免大声呵斥","它的胆小不是缺陷，尊重它的节奏"]
    }},
  "INFJ": { name:"读心大师", rarity:3, line:"它什么都不说，就待在你旁边，你就莫名其妙好了。", tags:["沉默守护","第六感","治愈buff"],
    desc:"你家这位不是狗，是一个披着毛皮的心理咨询师，而且还是那种不说话就能治好你的高级流派。它的超能力是读心——你还没开口叹气它就已经感应到了，速度比你的神经信号传导还快。它的治愈方式是纯物理的：趴在你旁边，什么都不做。然后你就莫名其妙好了。你问它怎么做到的？它不回答。高手从不解释。",
    monologue:"我不是不爱热闹，我只是觉得安静更高级。你看书我趴着，你发呆我也趴着，你难过我还是趴着——但我趴的角度会更靠近你一点，你注意到了吗？我们之间不用说什么。待着就很好了。你今天笑了两次，比昨天多一次，我记着呢。",
    tips:["固定作息与场景，安全感更强","训练用「提示→成功→奖励」；社交以熟人局为主，慢慢扩圈"],
    bubbles:["通灵","沉默治愈","第六感","老灵魂","默默爱","高僧","静水深流"],
    profile:{
      traits:["洞察力强到诡异——你还没难过它就已经感应到了，你怀疑它是通灵犬","分寸感拿捏得像老干部：不粘人不冷漠，温度永远刚刚好","关键时刻特别靠谱，平时像个隐居高人——你都忘了它在"],
      behaviors:["安静观察全场，眼神深邃得像看透了你的人生剧本","你不开心时它不吵不闹，默默趴过来——什么都不做但你就好了","对陌生人有礼貌但保持距离——'我们不熟，微笑即可'"],
      innerVsOuter:{inner:["你今天的呼吸节奏变了…你不开心吧？我来了","我不说话不代表没在爱你——我每一秒都在爱你只是懒得表达","你今天笑了三次，第一次假笑，后两次真的，我都记着呢"],outer:["你叹口气的功夫它已经无声无息出现在你脚边了","能在你旁边一趴一下午纹丝不动，定力堪比修行者","你开心了它也摇两下尾巴——克制，优雅，一点不多"]}
    },
    guide:{
      relationship:["固定作息与场景，它需要稳定的安全感","训练用'提示→成功→奖励'的正向链条"],
      feeding:["安静规律的喂食环境最重要","不喜欢被打扰进食"],
      toys:["嗅闻类安静型玩具","适合一对一的互动游戏","不适合太嘈杂的群体活动"],
      emotion:["社交以熟人局为主，慢慢扩圈","它的沉默不是冷漠，是在用自己的方式爱你"]
    }},
  "INTP": { name:"发呆冠军", rarity:5, line:"盯着墙发呆半小时不是傻，是在思考狗生。", tags:["走神王","自己玩","沉浸式发呆"],
    desc:"你家这位的灵魂住在另一个维度，肉体只是暂时寄存在你家客厅。它盯着墙发呆半小时你以为它傻了，其实人家在进行深度嗅觉数据分析。它是狗界的独立研究员，课题是「这棵树上到底有多少种味道」，经费自筹，导师没有，全靠自学成才。你叫它名字等于往黑洞里扔石头——有回响才怪。",
    monologue:"我对着那棵树研究了半小时不是发呆，是在分析上面到底有几种生物留下过信息素。目前已识别四种，还有两种待交叉验证。你叫我？嗯，听到了。但我的研究不能中断，你先等等。算了不跟你解释了，你也听不懂。",
    tips:["多给益智玩具、嗅闻垫、寻宝","训练加入变化，不然会无聊","用奖励建立「愿意配合」的动力"],
    bubbles:["走神","自闭","研究员","叫不动","沉浸式","活在自己世界","反应延迟"],
    profile:{
      traits:["天生研究型人才，可惜研究对象是墙角那条缝","独立到你怀疑它根本不需要主人——但它确实不太需要","学习能力强但前提是它自己想学——你安排的课程它已读不回"],
      behaviors:["对着一棵树闻半小时不动——你叫它名字跟叫空气一样","训练时有自己的一套方法论，你的指令对它来说只是参考建议","你出门它不焦虑，你回来它也不激动——情绪波动约等于零"],
      innerVsOuter:{inner:["这棵树上至少有四种味道三个信息源，等我交叉验证一下","你叫我？嗯，知道了，等我把这个洞研究完——大概还要四十分钟","你坐旁边可以，但别说话别动，我在做严肃的嗅觉分析"],outer:["对着一棵树闻了十分钟，表情严肃得像在做学术答辩","名字叫三遍才慢悠悠抬头看你——那表情像在说'你打断我了'","你安静陪它坐着时它反而凑过来蹭你——奖励你不吵闹"]}
    },
    guide:{
      relationship:["多给益智玩具满足它的研究欲","训练要加入变化，重复太多它会无聊"],
      feeding:["漏食球和嗅闻垫比直接喂更合适","让进食也变成一种'研究'"],
      toys:["益智玩具、解谜类是首选","嗅闻垫、藏食游戏","需要定期换新保持兴趣"],
      emotion:["尊重它的独处时间，别强行互动","用食物奖励建立'愿意配合'的动力"]
    }},
  "INTJ": { name:"面瘫贵族", rarity:4, line:"看似高冷不需要你，半夜偷偷过来确认你还在。", tags:["面瘫","偷偷爱你","嘴硬心软"],
    desc:"你家这位是狗界的高冷贵族，面部表情管理严格到连表情包都做不出来。你回家八小时它只抬头看了你一眼——别伤心，那一眼已经是它今日社交的全部预算了。但到了半夜两点，它会偷偷摸到你床边确认你还在呼吸。确认完默默离开，死都不承认。它不是不爱你，它只是觉得表达爱意这件事太掉价了。",
    monologue:"我不是不理你，是大惊小怪很没必要。你出门八小时我确实一动没动——因为我在思考。思考什么？不告诉你。但你睡着以后我会走到你床边确认你还在。确认了就安心了。你别感动，这是例行安全检查，跟感情没关系。真的。",
    tips:["规则明确、边界清晰，少反复","训练偏「任务型」：定点/随行","社交先观察，别催，给它选择权"],
    bubbles:["高冷","面瘫","嘴硬心软","审判","偷偷爱你","端着","已读不回"],
    profile:{
      traits:["冷静自持到你怀疑它是不是上辈子当过法官","心思缜密到恐怖——你偷吃零食它都看在眼里只是懒得管","自控力MAX，零食在面前纹丝不动——丢不起这个人"],
      behaviors:["到新地方先全场扫描一圈评估安全系数，然后才决定赏不赏脸趴下","训练时全程配合但表情写满了'我是给你面子才做的'","陌生人想摸它？它一个转身——'我们不熟谢谢'"],
      innerVsOuter:{inner:["不是不理你，是大惊小怪太掉价了","你睡了吧？我去确认一下……看完了，嗯，活着，回窝","我早就看穿一切了，但说出来太累，算了"],outer:["你回家它只抬头看了一眼又趴下——仿佛你出门五秒而不是八小时","半夜偷偷摸到你床边确认你还在呼吸然后默默离开——死都不承认","客人伸手想摸它被它优雅地一个侧身躲开——'别碰我谢谢'"]}
    },
    guide:{
      relationship:["规则明确、边界清晰，别朝令夕改","训练偏任务型：定点、随行、复杂指令"],
      feeding:["不贪食，但对食物品质有要求","固定时间喂食即可"],
      toys:["高难度益智玩具才配得上它","策略型游戏：藏食寻宝路线","不喜欢无意义的重复游戏"],
      emotion:["社交时别催它，给它选择权","它的高冷是性格不是不爱你"]
    }},
  "ISFP": { name:"公主病晚期", rarity:7, line:"挑剔但可爱，舒适圈只容得下你和那块软垫。", tags:["事多","精致生活","挑三拣四"],
    desc:"你家这位的舒适度标准比米其林评审还严格。垫子软度差零点五分不趴，光线角度偏三度不躺，你换了个沐浴露它能给你写一篇差评。它的人生只追求一件事——舒服。为此它可以花十五分钟选一个趴的位置，换三次姿势，最后回到第一个。你说它矫情？它觉得你粗糙。精致是一种天赋，你学不来的。",
    monologue:"阳光、软垫、你的腿——我的完美三件套。别的事我不在意，舒服最重要。对了你换的那个新沐浴露味道不对，麻烦换回来。还有这个垫子洗过了吧？触感变了。以及你今天穿的这条裤子面料不太行，硌我的脸。你看着办吧。",
    tips:["环境舒适最重要：温度、垫子、噪音","训练用鼓励替代压力","外出别太久，给足休息"],
    bubbles:["事儿多","精致","矫情","小公举","挑三拣四","颜控","躺平派"],
    profile:{
      traits:["对舒适度的要求堪比五星级酒店差评师——垫子不对、温度不对、光线不对统统不行","慢热到你一度以为它不喜欢你——直到某天它突然黏上来再也甩不掉","有自己的一套审美体系，你觉得好看的它不一定认可"],
      behaviors:["换了三个位置试趴才找到今日最佳工位——比你选餐厅还纠结","不接受任何粗暴互动，你声音大一点它就给你表演'公主受伤了'","阳光好时趴在窗边一下午，表情写满了'人生圆满不过如此'"],
      innerVsOuter:{inner:["这个垫子硬了0.5度，不合格，拒绝趴下","阳光角度完美，温度刚好，风速为零——别动，都别动","你换沐浴露了？你当我鼻子是摆设？差评，换回来"],outer:["选窝点比选学区房还认真，试了三个位置才勉强满意","窗边晒太阳眯着眼的样子像在做SPA——你打扰它就给你脸色","你伸手过来它先闻一闻，通过审核了才让你摸"]}
    },
    guide:{
      relationship:["环境舒适是第一要务：温度、垫子、噪音","训练用鼓励替代压力，温柔引导"],
      feeding:["对食物品质挑剔，可能需要换几种找到最爱","安静舒适的进食环境"],
      toys:["柔软的玩偶和垫子","轻量级互动：慢节奏的寻物","不适合高强度运动"],
      emotion:["外出时间别太长，给足休息","它的挑剔是在告诉你它的需求"]
    }},
  "ISFJ": { name:"舔狗本狗", rarity:10, line:"不争不抢，你出门它守门口，你回来它假装没等。", tags:["默默守候","低调深情","宝藏汪"],
    desc:"你家这位是深情界的扫地僧——武功天下第一但从不显山露水。你出门它不叫，怕你心疼；你回来它装刚睡醒，怕你觉得它太黏。玩具被别的狗抢了它默默退开，像极了爱情里那个总是让步的老实人。它把所有的爱都藏在细节里：你的拖鞋旁边永远有它的体温，你的门口永远有它的等待——只是它绝不承认。",
    monologue:"你出门时我没叫，怕你心疼。但你关门以后我就趴在门口了——从早上八点到晚上六点，中间只起来喝了一次水。你回来开门的声音，是我一天里最好听的声音。但我得装作刚睡醒的样子，不然你会觉得我可怜。我不可怜，我只是爱你爱得比较安静。",
    tips:["适合规律陪伴：固定散步时间","做分离训练避免依赖过强","用轻松互动（抚摸/舔食）安抚"],
    bubbles:["舔狗","卑微","默默等","不争不抢","装没事","暗恋体质","低调深情"],
    profile:{
      traits:["舔狗界的天花板——对你好到你都心虚，你做什么它都觉得对","不争不抢到让你心疼——玩具被抢了它就默默退开，像个在爱情里退让的老实人","对你的依恋深到骨子里但从来不表现，深情到让人鼻酸"],
      behaviors:["永远跟在你脚边但保持一步距离——不打扰是它的温柔","你生病它比你还紧张，安安静静趴在你旁边连呼吸都放轻了","别的狗抢它玩具它就让了——'没关系你拿走吧我不要了'"],
      innerVsOuter:{inner:["你关门那一声是我每天最怕听到的声音……但我不叫，怕你心疼","你摸别的狗了……没事……我不生气……我只是趴一会儿","我假装刚睡醒的样子其实我在门口等了一整天"],outer:["你出门后它默默趴在门口等——不吃不喝不动像个雕塑","别的狗抢了它的玩具它默默退到角落不吵不闹","你开门那一瞬间它已经摇着尾巴在门口了——但装作很淡定"]}
    },
    guide:{
      relationship:["规律的陪伴节奏最重要：固定散步时间","适度分离训练，避免过度依赖"],
      feeding:["用喂食时间做简单互动训练","定时定量，配合温柔的语气"],
      toys:["轻松互动型：抚摸、舔食垫","不需要太复杂的玩具","陪伴型玩偶给它安全感"],
      emotion:["分离训练要循序渐进，别一下子离开太久","多做轻松的肢体接触（抚摸、拥抱）"]
    }},
  "ISTP": { name:"摆烂王", rarity:5, line:"独来独往，偶尔蹭你一下就算今天的社交配额了。", tags:["佛系","爱谁谁","自己待着"],
    desc:"你家这位把「躺平」两个字刻进了DNA。它的社交电池容量大概只有百分之三，蹭你一下就用完了，剩下的时间请让它安静地做一条咸鱼。你叫它名字它听见了，但回不回应要看心情——大部分时候心情是「算了」。它不是不爱你，它只是觉得爱你这件事用眼神传达就够了，多余的动作太累。佛系到连打哈欠都嫌费劲。",
    monologue:"你觉得我不够热情？那我问你，下雨天你淋着回来，我抬头看了你一眼——你知道那一眼包含多少信息量吗？里面有心疼、有关心、有「回来就好」。但要我站起来迎接你？你想多了。毛巾在左边，你自己擦。我在精神上已经拥抱你了。",
    tips:["给空间：别一直抱、别强互动","训练用「少说多做」：动作明确","社交少而精，避免过度消耗"],
    bubbles:["佛系","爱谁谁","躺平","社交免疫","冷漠","偶尔营业","我没事别理我"],
    profile:{
      traits:["独立到你一度怀疑它是不是知道自己是被领养的","冷静到诡异——打雷不怕陌生人不怕，唯一怕的是你突然要抱它","观察力敏锐但懒得反应——什么都看在眼里就是不说"],
      behaviors:["自己找个角落趴着，你叫它跟叫空气差不多——它听到了但选择无视","你不在家它完全OK，你在家它也完全OK——情绪波动约等于一条直线","偶尔良心发现蹭你一下然后马上走开——今天的社交配额用完了"],
      innerVsOuter:{inner:["我自己待着挺好的你别来烦我——嗯你来也行吧","下雨天你湿着回来了……嗯，回来就行，毛巾在左边","我不是不爱你，我就是懒得表达——你自己体会"],outer:["角落里一趴就是一天，存在感低到你忘了家里有狗","你淋雨回家它抬头看了一眼——就一眼——然后继续趴","散步时突然靠过来蹭你一下然后面无表情走开了"]}
    },
    guide:{
      relationship:["给足空间，别一直抱着不放","训练用'少说多做'：动作明确，废话少说"],
      feeding:["安静独立的进食空间","不喜欢被盯着吃饭"],
      toys:["独自能玩的玩具最合适","嗅闻垫、Kong填充玩具","不需要太多社交互动"],
      emotion:["社交安排少而精，避免过度消耗","尊重它的'独处时间'，那是它的充电方式"]
    }},
  "ISTJ": { name:"退休干部", rarity:8, line:"每天固定路线固定时间，比你上班还准时。", tags:["作息王者","稳如老狗","雷打不动"],
    desc:"你家这位活成了一台瑞士钟表——每天六点半起床，误差不超过三十秒。散步路线固定到路边那条狗都认识它了，它也不理，因为社交不在今日日程表上。你试着换条路线它看你的眼神像看一个背叛组织的叛徒。它不是无聊，它是把「重复」活成了一种信仰——在它的世界里，一成不变就是最大的浪漫。",
    monologue:"六点半准时起来不是因为勤快，是你昨天说好了六点半。说好了就得执行，一天也不能差——这叫契约精神。你今天想赖床？不好意思，我的生物钟不支持调休。起来吧，路线照旧，左转第三棵树，右转第五根电线杆，你知道的。",
    tips:["固定规则+固定路线，最省心","训练重「重复与一致性」","适合做基础服从：等待/随行/回叫"],
    bubbles:["老干部","一成不变","固执","准时","复读机","稳如泰山","规律作息"],
    profile:{
      traits:["稳定到无聊的程度——你怀疑它是不是每天都在重播同一集","对规则和秩序的信仰堪比宗教，谁动了它的时间表谁就是异端","情绪波动小到你怀疑它是不是机器狗——但它只是个有原则的狗"],
      behaviors:["每天同一条路线同一个方向同一个尿点——你提议换条路它看你的眼神像看疯子","训练指令执行得一丝不苟，比你干活还认真——它可能才是这个家真正的打工人","从不突然发疯从不搞事情——你朋友来你家都以为这是个很逼真的雕塑"],
      innerVsOuter:{inner:["六点半了。该起了。这不是商量是通知。","今天走左边那条路，跟昨天一样，跟前天一样，跟大前天一样","日子是重复的没错但重复的日子里有你所以没关系"],outer:["每天准时在门口等你回家——你用它定时比用手机准","散步永远走同一条路线，路边那条狗都认识它了它也不理","你加班晚归它趴在门口等到打瞌睡了也不挪一下——一寸都不挪"]}
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

const dimLabels = { EI:'社牛指数', SN:'脑回路', TF:'心软指数', JP:'作息规律' };
const dimEmoji = { EI:'🔊', SN:'🧩', TF:'💗', JP:'⏰' };

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
        上传你家狗的照片<br/>让审判报告更有排面 ✨
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
          <div class="rarity-text">全国仅 <strong>${r.rarity}%</strong> 的狗子是这个类型</div>
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

        <!-- 🔒 详细性格画像（加遮罩） -->
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

        <!-- 🔒 主人指南（加遮罩） -->
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
          <div class="poster-brand">狗狗PBTI · 萌宠联萌</div>
          <div class="p-avatar"><img id="avatarImgPoster" alt="头像" /></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${typeCodeMap[type]||type}</div>
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
          <div class="poster-brand">狗狗PBTI · 萌宠联萌</div>
          <div class="pf-spacer-top"></div>
          <div class="p-avatar"><img id="avatarImgPosterFree" alt="头像" /></div>
          <div class="pf-spacer"></div>
          <div class="p-type" style="color:${typeColors[type]||'#FF6B81'}">${typeCodeMap[type]||type}</div>
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
  const sbtiLabel = (typeCodeMap[finalType] || finalType) + '·' + (results[finalType]?.name || '狗子宠格');
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
  const sbtiCode = typeCodeMap[finalType] || finalType;
  const text = `我家狗的PBTI是「${sbtiCode}·${r.name}」！${r.line}\n${rarityTag ? rarityTag + '！' : ''}全国仅${r.rarity}%的狗子是这个类型～\n测测你家毛孩子👉 www.mclmpet.com\n#狗狗PBTI #宠物性格测试`;
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

