/**
 * Finn · 孟乐的数字岛屿 — 交互逻辑与艺术微动效
 * 纯原生 JavaScript，零外部前端依赖
 */

(function () {
  'use strict';

  // --- 1. Web Audio API 合成轻量微交互音效 ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem('finn_sound') === 'muted';
      if (this.muted) {
        document.body.classList.add('sound-muted');
      }
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.init();
      this.muted = !this.muted;
      localStorage.setItem('finn_sound', this.muted ? 'muted' : 'active');
      document.body.classList.toggle('sound-muted', this.muted);
      if (!this.muted) {
        this.play('click');
      }
    }

    play(type = 'click') {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'stamp') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'chime') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    }
  }

  // --- 1.1 移动端轻量触觉微震动反馈 (Haptic Feedback) ---
  function triggerHaptic(duration = 8) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }

  // --- 1.2 Web Audio API 纯算法合成「青岛海岸潮汐与海浪声景」(Island Ambient Surf) ---
  class OceanSoundscape {
    constructor() {
      this.ctx = null;
      this.playing = false;
      this.masterGain = null;
      this.sourceNode = null;
      this.lfo = null;
      this.wasPlayingBeforeHidden = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    start() {
      this.init();
      if (!this.ctx || this.playing) return;

      const now = this.ctx.currentTime;

      // 生成 6 秒无缝循环的布朗/粉红积分噪声 (Brownian Noise)
      const bufferSize = this.ctx.sampleRate * 6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.024 * white)) / 1.024; // 积分滤波生成浑厚深海低频
        lastOut = data[i];
        data[i] *= 3.4; // 增益补偿
      }

      this.sourceNode = this.ctx.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.loop = true;

      // 双极低通滤波器 (模拟海水潮头浪涌)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      filter.Q.setValueAtTime(2.2, now);

      // 潮汐呼吸 LFO (周期约 8.5 秒，模拟真实海岸海浪起伏)
      this.lfo = this.ctx.createOscillator();
      this.lfo.frequency.setValueAtTime(0.118, now); // ~8.5s 一潮
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(320, now); // 截止频率在 100Hz ~ 500Hz 之间规律推移

      this.lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // 海风与白浪飞沫次级滤网 (高频浪花沫声)
      const sprayFilter = this.ctx.createBiquadFilter();
      sprayFilter.type = 'bandpass';
      sprayFilter.frequency.setValueAtTime(1200, now);
      sprayFilter.Q.setValueAtTime(0.7, now);

      const sprayGain = this.ctx.createGain();
      sprayGain.gain.setValueAtTime(0.035, now);

      // 主增益节点 (支持平滑淡入淡出，避免爆音)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.11, now + 2.0); // 2秒轻柔渐入

      this.sourceNode.connect(filter);
      filter.connect(this.masterGain);

      this.sourceNode.connect(sprayFilter);
      sprayFilter.connect(sprayGain);
      sprayGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);

      this.sourceNode.start(now);
      this.lfo.start(now);
      this.playing = true;
      this.updateUI(true);
    }

    stop() {
      if (!this.playing || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(0.001, now + 1.2);
      setTimeout(() => {
        if (this.sourceNode) {
          try { this.sourceNode.stop(); } catch(e) {}
          this.sourceNode.disconnect();
          this.sourceNode = null;
        }
        if (this.lfo) {
          try { this.lfo.stop(); } catch(e) {}
          this.lfo.disconnect();
          this.lfo = null;
        }
        this.playing = false;
        this.updateUI(false);
      }, 1250);
    }

    toggle() {
      triggerHaptic(12);
      if (this.playing) {
        this.stop();
        showToast('已关闭 青岛潮汐声景 🌊');
      } else {
        this.start();
        showToast('已开启 青岛潮汐声景 · 听海中 🌊');
      }
    }

    updateUI(isPlaying) {
      const ambientBtn = document.getElementById('ambient-toggle');
      const cardSurfBtn = document.getElementById('card-surf-btn');
      if (ambientBtn) {
        ambientBtn.classList.toggle('playing', isPlaying);
        ambientBtn.title = isPlaying ? '青岛海岸潮汐声景：播放中（点击关闭）' : '青岛海岸潮汐声景：已关闭（点击开启）';
      }
      if (cardSurfBtn) {
        cardSurfBtn.classList.toggle('playing', isPlaying);
        const text = cardSurfBtn.querySelector('.card-surf-text');
        if (text) text.textContent = isPlaying ? '潮汐播放中' : '潮汐声景';
      }
    }
  }

  const sfx = new SoundFX();
  const surf = new OceanSoundscape();

  const soundToggleBtn = document.getElementById('sound-toggle');
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      triggerHaptic(8);
      sfx.toggle();
    });
  }

  const ambientToggleBtn = document.getElementById('ambient-toggle');
  if (ambientToggleBtn) {
    ambientToggleBtn.addEventListener('click', () => surf.toggle());
  }

  const cardSurfBtn = document.getElementById('card-surf-btn');
  if (cardSurfBtn) {
    cardSurfBtn.addEventListener('click', () => surf.toggle());
  }

  // 页面离开时自动淡出，返回时平滑恢复
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (surf.playing) {
        surf.stop();
        surf.wasPlayingBeforeHidden = true;
      }
    } else {
      if (surf.wasPlayingBeforeHidden) {
        surf.start();
        surf.wasPlayingBeforeHidden = false;
      }
    }
  });

  // --- 2. 主题切换 (日出白纸 / 深夜星屿) ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const htmlRoot = document.documentElement;

  function initTheme() {
    const savedTheme = localStorage.getItem('finn_theme') || 'light';
    htmlRoot.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    triggerHaptic(10);
    const current = htmlRoot.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    htmlRoot.setAttribute('data-theme', next);
    localStorage.setItem('finn_theme', next);
    sfx.play('click');
    showToast(next === 'dark' ? '已开启 深夜星屿模式 ✦' : '已开启 日出白纸模式 ☀️');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  initTheme();

  // --- 3. 全局 Toast 提示组件 ---
  const toastEl = document.getElementById('toast');
  const toastMsgEl = document.getElementById('toast-msg');
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl || !toastMsgEl) return;
    toastMsgEl.textContent = message;
    toastEl.classList.add('visible');
    sfx.play('chime');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 3200);
  }

  // 剪贴板复制工具
  async function copyText(text, successMsg = '已成功复制到剪贴板') {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      success = false;
    }

    if (!success) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        success = document.execCommand('copy');
      } catch (e) {
        success = false;
      }
      textarea.remove();
    }

    if (success) {
      showToast(successMsg);
    } else {
      showToast('复制未完成，请长按文字手动复制');
    }
  }

  // --- 4. 复制事件绑定 ---
  document.querySelectorAll('[data-wechat-copy]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      copyText('18300425760', '微信号 18300425760 已复制！');
    });
  });

  const btnCopyIntro = document.getElementById('btn-copy-intro');
  const introBioText = document.getElementById('intro-bio-text');
  if (btnCopyIntro && introBioText) {
    btnCopyIntro.addEventListener('click', () => {
      copyText(introBioText.textContent.trim(), '个人介绍已复制，欢迎交流！');
    });
  }

  // --- 5. 顶部阅读进度条 ---
  const progressBar = document.getElementById('reading-progress');
  function updateProgress() {
    if (!progressBar) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });

  // --- 6. 3D 鼠标跟随视差名片 ---
  const heroCardWrapper = document.querySelector('.hero-card-wrapper');
  const identityCard = document.getElementById('identity-card');

  if (heroCardWrapper && identityCard) {
    heroCardWrapper.addEventListener('mousemove', (e) => {
      const rect = identityCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -9;
      const rotateY = ((x - centerX) / centerX) * 9;

      identityCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      identityCard.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
      identityCard.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
    });

    heroCardWrapper.addEventListener('mouseleave', () => {
      identityCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  }

  // --- 7. 名片盖印微交互 ---
  const stampBtn = document.getElementById('stamp-interactive');
  if (stampBtn) {
    stampBtn.addEventListener('click', () => {
      triggerHaptic(18);
      stampBtn.classList.add('stamped');
      sfx.play('stamp');
      showToast('已盖下真实印记 ✦ 保持真实，让热爱有回响。');
      setTimeout(() => {
        stampBtn.classList.remove('stamped');
      }, 300);
    });
  }

  // --- 8. 实时时钟挂件 (UTC+8 青岛时区) ---
  const liveClock = document.getElementById('live-clock');
  function updateClock() {
    if (!liveClock) return;
    const now = new Date();
    // 转换为中国标准时间 (GMT+8)
    const options = {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const timeStr = new Intl.DateTimeFormat('zh-CN', options).format(now);
    liveClock.textContent = `青岛 ${timeStr} GMT+8`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // --- 9. 交互式工作流步骤展示 (AI-Koubo) ---
  const flowSteps = document.querySelectorAll('#koubo-flow .flow-step');
  const wfBadge = document.getElementById('wf-badge');
  const wfText = document.getElementById('wf-text');

  const workflowData = {
    1: {
      badge: '环节 01：输入与解构',
      text: '从碎片灵感、阅读笔记、直播录像与书籍中捕捉核心洞察，快速提炼主题并完成信息降噪。'
    },
    2: {
      badge: '环节 02：结构化脚本',
      text: '配合特定提示词结构与思维链，将模糊观点转化为符合短视频节奏、有悬念、有共情的文本脚本。'
    },
    3: {
      badge: '环节 03：AI 口播与音画对齐',
      text: '通过声音复刻、智能对口型与音画切片技术，实现高表现力但无需创作者反复重录的工业流。'
    },
    4: {
      badge: '环节 04：全渠道分发与复盘',
      text: '一站式输出封面、关键帧、字幕与多平台发布切片，追踪真实观众反馈并反哺脚本库。'
    }
  };

  flowSteps.forEach((step) => {
    step.addEventListener('click', () => {
      flowSteps.forEach((s) => s.classList.remove('active'));
      step.classList.add('active');
      const stepId = step.getAttribute('data-step');
      if (workflowData[stepId] && wfBadge && wfText) {
        wfBadge.textContent = workflowData[stepId].badge;
        wfText.textContent = workflowData[stepId].text;
      }
      sfx.play('click');
    });
  });

  // --- 9.1 五拱工作现场与三重视角交互 (Five Arches Paper Theatre & Tri-Perspectives) ---
  const WORKSHOPS_DATA = {
    1: {
      id: 1,
      ch: '01 / 05',
      title: '剪报与口播室',
      subtitle: '让真实声音与观点，进入自运转的工业级分发流',
      badge: 'AI-Koubo Studio',
      quote: '“别把时间耗在机械读稿上，把真知灼见留给世界。”',
      output: {
        typeBadge: '01 看产物 · ARTIFACT',
        badgeClass: 'badge-output',
        headline: 'AI-Koubo 剪报与口播全流程工业流水线',
        summary: '将长篇深度研报、高密度思想随笔与碎片化灵感，全自动解析重构成音画对齐、分镜切片、多渠道自适应的口播短视频与图文播客。',
        stats: [
          { label: '单条制作耗时', value: '从 6h 降至 25min' },
          { label: '累计处理沉淀', value: '50+ 篇深度研报' },
          { label: '对齐准确度', value: '99.2% 音画同步率' },
          { label: '发布矩阵', value: '视频号 / 抖音 / 小红书' }
        ],
        details: [
          {
            title: '环节 01：信息解构与智能降噪',
            desc: '通过特定的 LLM 结构化提取管道，从数万字材料中抽离高价值逻辑骨架与冲突点，剔除无用冗余叙述。'
          },
          {
            title: '环节 02：黄金完播率脚本重塑',
            desc: '融入前 3 秒钩子（Hook）、认知反差、层层递进与共情留白，生成符合移动端短视频心流的脚本。'
          },
          {
            title: '环节 03：音画嘴型精准切片对齐',
            desc: '基于自建专有名词映射词典与 Whisper 时间戳微调，克服专业术语吞音，使口播情绪与剪辑画面严丝合缝。'
          },
          {
            title: '环节 04：自适应封面与多端分发',
            desc: '自动生成高辨识度报刊杂志剪纸风封面、分层动态字幕与话题标签，支持一键沉淀进知识资产库。'
          }
        ]
      },
      rework: {
        typeBadge: '02 看返工 · REWORK & FAILURES',
        badgeClass: 'badge-rework',
        headline: '真实踩坑：两次推倒重来的迭代现场',
        summary: '没有一行 Prompt 是一蹴而就的。这是在无数次机械感、嘴型漂移与模型幻觉中，一次次推翻重构的真实记录。',
        details: [
          {
            title: '❌ 痛点一：通用大模型的口播稿冰冷、充满“爹味”与说教感',
            desc: '初期直接让通用模型写脚本，产出的内容极其空洞，充斥“综上所述”、“显而易见”，完全丧失了个人的真诚与呼吸感。'
          },
          {
            title: '🔧 返工重写：提取 30 期录音构建“个人语癖库”与 Few-shot 约束',
            desc: '拆解自己真实讲话中的停顿习惯、设问逻辑、口头叹词与情绪转折，编写了 12 条反 AI 腔调指令，逼迫模型以“坐在朋友对面聊天”的真实语态重构。'
          },
          {
            title: '❌ 痛点二：Whisper 自动对齐在专业英文与新兴术语上严重吞字',
            desc: '遇到 Transformer、Agent、DeepSeek 等生词时，开源 ASR 频繁漏字，导致剪辑轨产生 300ms–600ms 滞后，音画严重脱节。'
          },
          {
            title: '🔧 返工重写：自研前置拼音音素映射层 + 强制时间戳平滑算法',
            desc: '在语音合成与 ASR 之前切入词典正则替换，并在切片渲染端用轻量级脚本重新平滑音频波峰与字幕锚点，彻底解决音画错位。'
          }
        ]
      },
      tradeoff: {
        typeBadge: '03 看取舍 · TRADEOFFS & BOUNDARIES',
        badgeClass: 'badge-tradeoff',
        headline: '坚决克制：我们拒绝做什么',
        summary: '在 AI 能够无限量量产内容的时代，“不做什么”比“能做什么”更决定作品的灵魂。',
        details: [
          {
            title: '⛔ 坚决不做：全自动无人值守批量分发',
            desc: 'AI 可以承担 80% 的体力劳动（解构、打标、字幕、剪切），但每条内容的最终事实核验、价值观审视与情绪定稿，必须由人类双手过目确认。绝不向网络倾倒数字垃圾。'
          },
          {
            title: '⛔ 坚决不做：追求逼真数字人“恐怖谷”皮囊',
            desc: '拒绝使用眼神空洞的 4K 超拟真数字人。我们选用极简平面剪纸与原声复刻，让受众的注意力聚焦在思考与观点的密度上，而不是虚假的肢体摆动。'
          },
          {
            title: '💡 价值坚持：内容永远服务于长期信任',
            desc: '宁可每周只发 1 条有独特洞察的真挚视频，也不为了算法日更 5 条洗稿口水账。保持真实，让热爱有回响。'
          },
          {
            title: '💡 工具理念：人是导演与审核者，AI 是副驾与工匠',
            desc: '把工具放在工具的位置上，警惕把思考的自主权出让给概率矩阵。'
          }
        ]
      }
    },
    2: {
      id: 2,
      ch: '02 / 05',
      title: '空间构建台',
      subtitle: '把扁平的 Markdown 笔记，折叠成立体可漫游的知识星轨',
      badge: 'Starport & Vault',
      quote: '“线性阅读是沉重的，空间感让知识的隐蔽关联自主浮现。”',
      output: {
        typeBadge: '01 看产物 · ARTIFACT',
        badgeClass: 'badge-output',
        headline: '知识星港 (Starport) 与 冰藏知识库 (Bingcang Vault)',
        summary: '将多年沉淀的 300+ 篇深度笔记，通过力导向图算法与星际轨道投影，重构为可实时缩放、引力漫游的 3D/2.5D 交互式数字岛屿。',
        stats: [
          { label: '沉淀笔记节点', value: '300+ 深度图谱节点' },
          { label: '双链关联度', value: '1200+ 动态引力连线' },
          { label: '加载性能', value: '全端秒开 < 120ms' },
          { label: '渲染帧率', value: '移动端稳锁 60 FPS' }
        ],
        details: [
          {
            title: '引力拓扑动力学引擎',
            desc: '节点根据语义亲疏程度产生万有引力与库仑斥力，自动聚类为 AI 哲学、商业模式、前端手作、生活感悟等星系团。'
          },
          {
            title: '视差星轨巡航视角',
            desc: '支持鼠标与触摸手势的三维倾角漫游，点击星体即可平滑推进查看双链溯源与灵感脉络。'
          },
          {
            title: '冰藏极简速查架构',
            desc: '即使脱离网络或在低算力设备上，纯静态构建产物依然支持极速模糊搜索与零时延阅读。'
          },
          {
            title: '双向思维桥接卡片',
            desc: '每篇笔记底部自动呈现上下游灵感依赖，打通碎裂思考的最后闭环。'
          }
        ]
      },
      rework: {
        typeBadge: '02 看返工 · REWORK & FAILURES',
        badgeClass: 'badge-rework',
        headline: '性能崩溃之痛：从 4MB 引擎到轻量 Canvas 重构',
        summary: '从酷炫的 3D 玩具，进化为真正轻巧趁手的思想工具，经历过极其痛苦的性能倒逼。',
        details: [
          {
            title: '❌ 痛点一：引入 Three.js 庞大库，手机端发烫、掉帧卡顿',
            desc: '早期为了追求光影阴影引入重型 3D 渲染器，首屏资源超 4.2MB，在 iPhone 微信内置浏览器打开掉帧至 18fps，几分钟后手机严重发烫。'
          },
          {
            title: '🔧 返工重写：果断废弃 Three.js，改用原生 Canvas 2.5D 矩阵手写',
            desc: '推倒所有第三方依赖，用纯数学公式计算透视缩放与坐标投影。打包体积暴降 94%，首屏零等待，任何千元机上都能如丝般顺滑运行。'
          },
          {
            title: '❌ 痛点二：全量节点联结导致界面沦为混乱的“毛线球”',
            desc: '当笔记数量增加到上百篇时，连线纵横交错，用户完全看不懂脉络，除了“看起来很炫”之外毫无信息获取价值。'
          },
          {
            title: '🔧 返工重写：三级引力分层拓扑架构（恒星 / 行星 / 卫星）',
            desc: '重构节点权重逻辑：核心信念为恒星常驻，长期项目为行星环绕，而碎片笔记只在视口聚焦放大到特定阈值时才渐显展开。'
          }
        ]
      },
      tradeoff: {
        typeBadge: '03 看取舍 · TRADEOFFS & BOUNDARIES',
        badgeClass: 'badge-tradeoff',
        headline: '拒绝对虚假关联的病态迷恋',
        summary: '不做为了秀技而秀技的视觉垃圾，让空间服务于思维的纯净。',
        details: [
          {
            title: '⛔ 坚决不做：让大模型擅自“自动脑补”笔记关系',
            desc: '拒绝利用向量距离强行给两篇毫不相干的思考连线。知识图谱的每一条连线，必须源自作者在实践中的真实灵感碰撞，坚决剔除幻觉连线。'
          },
          {
            title: '⛔ 坚决不做：无限深度的树状嵌套文件夹',
            desc: '树状目录往往是知识的墓地，让人陷入分类整理的强迫症内耗。在空间台里，所有知识按引力与星团自然聚集。'
          },
          {
            title: '💡 价值坚持：纯静态第一，永不绑架用户数据',
            desc: '拒绝任何需要专属云服务绑定的私有格式，所有底层笔记永远是干净、通用的纯文本 Markdown。'
          },
          {
            title: '💡 交互坚持：动画不得阻碍信息获取',
            desc: '任何转场动画时长严格限制在 200ms 以内，支持即点即看，绝不让用户在无聊的炫技过渡动画里浪费时间。'
          }
        ]
      }
    },
    3: {
      id: 3,
      ch: '03 / 05',
      title: '价值实验室',
      subtitle: '青少年心理沟通支持与数字陪伴的伦理边界探索',
      badge: 'Anxin-Da Prototype',
      quote: '“AI 不做审判席上的心理医生，而要做一面温和、不带偏见的情绪透镜。”',
      output: {
        typeBadge: '01 看产物 · ARTIFACT',
        badgeClass: 'badge-output',
        headline: '安心答 (Anxin-Da) — 青少年家庭情绪沟通原型系统',
        summary: '针对青少年与家长之间“想说却说不出口”的断裂带，搭建的双重视角双向镜像交互原型，提供非暴力沟通重塑与情绪安全屋。',
        stats: [
          { label: '交互双视角', value: '孩子倾诉端 / 家长共情端' },
          { label: '安全防御层', value: '三级敏感词加权状态机' },
          { label: '伦理边界', value: '0 疾病诊断 / 100% 危机求助指引' },
          { label: '设计原则', value: '非评判倾听与去中心化安全' }
        ],
        details: [
          {
            title: '情绪双向翻译透镜',
            desc: '将青少年充满防御性的“别管我，烦死了”温和解码为背后未被满足的尊重需求；将家长带有说教色彩的质问转化为表达关心的句式。'
          },
          {
            title: '非评判式倾听底座',
            desc: '摒弃好为人师的人生说教，采用心理学倾听复述模型，为年轻人提供不被打断、不被评价的安全倾诉容器。'
          },
          {
            title: '情绪温度计与能量波动表',
            desc: '以柔和的色温变化感知当前对谈的压力值，在双方情绪过载前主动提供“呼吸降温”缓冲空间。'
          },
          {
            title: '安全兜底与危机直连机制',
            desc: '内置多重高危语义过滤，遇到极端自伤、绝望等信号时，无缝切入国家官方青少年心理救援绿色通道。'
          }
        ]
      },
      rework: {
        typeBadge: '02 看返工 · REWORK & FAILURES',
        badgeClass: 'badge-rework',
        headline: '直面伦理雷区：提示词与安全机制的生死修正',
        summary: '面对人心的脆弱，任何一丝算法的傲慢都是灾难。这是安心答最严肃的打磨历程。',
        details: [
          {
            title: '❌ 痛点一：初版模型输出浓厚的说教味，给出“五条走向成功建议”',
            desc: '当青少年输入“我觉得我什么都做不好，很想逃跑”时，通用大模型竟然生成了列点的行动清单，导致测试者产生被否定和更深的挫败感。'
          },
          {
            title: '🔧 返工重写：彻底重构 System Prompt，确立“不指手画脚”四不原则',
            desc: '禁止提供解决方案，禁止下定义，禁止横向比较。强制模型仅做：“情绪确认（I hear you）+ 感受命名 + 温暖陪伴”，把倾诉空间完整还给孩子。'
          },
          {
            title: '❌ 痛点二：越狱提示词与危机语义漏判风险',
            desc: '测试中发现复杂的倒装句与隐晦文学表达（如“如果明天太阳不再升起我也无所谓了”），云端过滤接口返回正常，存在安全盲区。'
          },
          {
            title: '🔧 返工重写：本地加权情感分析状态机 + 敏感语义熔断机制',
            desc: '脱离对单一 API 的依赖，在前端与边缘网关设计加权触发规则。一旦危险系数超标，立刻弹出温和的专业求助热线卡片。'
          }
        ]
      },
      tradeoff: {
        typeBadge: '03 看取舍 · TRADEOFFS & BOUNDARIES',
        badgeClass: 'badge-tradeoff',
        headline: '恪守底线：在能够做和应该做之间划定红线',
        summary: '技术越有能力，越要有敬畏之心。我们决不把商业变现建立在对心理隐私的剥削上。',
        details: [
          {
            title: '⛔ 坚决不做：给出任何心理疾病诊断结论',
            desc: '严禁模型出现“你可能患有抑郁/焦虑”等医疗断语。AI 永远不是医生，绝不越俎代庖，只做生活中的温和倾听者。'
          },
          {
            title: '⛔ 坚决不做：向家长端单向透明出卖孩子的对话隐私',
            desc: '拒绝做所谓的“家长监控雷达”。没有绝对的信任就没有真实的倾诉。家长端仅能看到双方共同授权的情绪概览与沟通桥梁建议。'
          },
          {
            title: '💡 价值坚持：安全第一于交互趣味性',
            desc: '宁可在极端情况下触发“过度防护”，也绝不放过任何一次可能造成现实伤害的信号遗漏。'
          },
          {
            title: '💡 伦理坚持：技术要让人走向真实人际，而不是逃避现实',
            desc: '安心答的终极目标不是让用户依赖 AI，而是帮助孩子与父母重建现实中的真实对话。'
          }
        ]
      }
    },
    4: {
      id: 4,
      ch: '04 / 05',
      title: '原生开发台',
      subtitle: '零繁复依赖、纯原生技术栈，从零行代码到可验证的真实产品',
      badge: 'Native & Vibe Coding',
      quote: '“工具越重，念头死得越快；轻巧的原生代码，能以最快速度把假设推向现实。”',
      output: {
        typeBadge: '01 看产物 · ARTIFACT',
        badgeClass: 'badge-output',
        headline: '《人海冲锋》Canvas 敏捷小游戏 / 智能 Agent / 本地化工具',
        summary: '贯彻“纯原生手作”理念，不依赖笨重的现代构建黑盒，用最纯粹的 HTML5、CSS3 与 Vanilla JS 交付极致轻量但富有交互趣味的实际项目。',
        stats: [
          { label: '外部构建依赖', value: '0 npm packages' },
          { label: '小游戏打包体积', value: '整包仅 68 KB' },
          { label: '冷启动速度', value: '零转译，0.05s 秒开' },
          { label: '跨端兼容', value: '现代浏览器 100% 覆盖' }
        ],
        details: [
          {
            title: '《人海冲锋》街机跑酷纯 Canvas 小游戏',
            desc: '手写 requestAnimationFrame 物理引擎、碰撞检测、动态粒子系统与音效合成，复古街机像素手感。'
          },
          {
            title: '轻量化本地商户营销 Agent 辅助脚本',
            desc: '基于纯原生脚本与自动化测试流水线，高效聚合本地生活点评与竞争态势，输出结构化策略报告。'
          },
          {
            title: '本站（Finn 个人数字岛屿）纯原生架构',
            desc: '零 Webpack/Vite 捆绑，单目录纯静态，双击即可在任何机器上跑起，代码清澈如泉水。'
          },
          {
            title: 'Web Audio API 实时无损音效合成',
            desc: '不加载任何外部 MP3/WAV 资源，通过振荡器实时运算物理按键与敲击声音，体验无负担。'
          }
        ]
      },
      rework: {
        typeBadge: '02 看返工 · REWORK & FAILURES',
        badgeClass: 'badge-rework',
        headline: '与复杂性搏斗：推翻重型框架的轻量化革命',
        summary: '很多人以为用框架才算专业，直到被各种打包体积、兼容性报错与升级断代折磨得体无完肤。',
        details: [
          {
            title: '❌ 痛点一：初版套用第三方重型开源小游戏引擎，微信内置环境白屏',
            desc: '一开始为了走捷径套用了某知名 HTML5 游戏框架，包含一堆用不到的 3D/物理依赖，微信内打开不仅白屏加载长达 4 秒，还报出难以追踪的 WebGL Context 丢失错误。'
          },
          {
            title: '🔧 返工重写：全部推倒，用纯原生 2D Context 与对象池技术重写',
            desc: '自己实现简单的 AABB 碰撞检测与粒子复用对象池（Object Pool），杜绝垃圾回收卡顿（GC Pause），整包从 8.5MB 缩减至 68KB，微信秒开。'
          },
          {
            title: '❌ 痛点二：爬虫与 Agent 在遇到反爬与复杂 DOM 变动时频繁报错',
            desc: '早期写死的 XPath 与 CSS 选择器极度脆弱，目标页面稍有变动脚本就抛出 null reference。'
          },
          {
            title: '🔧 返工重写：语义特征锚点匹配 + 容错重试状态机',
            desc: '改用上下文语义与正则模糊匹配，配合退避重试算法，使脚本在无头浏览器环境下的采集成功率稳定在 99% 以上。'
          }
        ]
      },
      tradeoff: {
        typeBadge: '03 看取舍 · TRADEOFFS & BOUNDARIES',
        badgeClass: 'badge-tradeoff',
        headline: '拒绝流行陷阱：十年后依然能够运行的代码',
        summary: '技术世界每年都在创造新的概念与术语，但真正经得起时间考验的是底层标准的坚实。',
        details: [
          {
            title: '⛔ 坚决不做：为了显得“现代化”而盲目引入 node_modules 黑盒',
            desc: '动辄上千个依赖包不仅带来供应链安全隐患，三年后几乎必然因为依赖版本废弃而无法编译。原生 HTML/CSS/JS 代码在 20 年后依然能够被标准浏览器无缝运行。'
          },
          {
            title: '⛔ 坚决不做：用重度动效牺牲低端设备用户的体验',
            desc: '所有动效优先采用 GPU 加速的 CSS transform/opacity，并增加 reduces-motion 与页面隐藏自动暂停逻辑，省电、发热低、不给用户设备添堵。'
          },
          {
            title: '💡 极简主义：最少代码实现最多价值',
            desc: '能用 50 行原生代码清晰解决的问题，绝不引入 500KB 的第三方库。'
          },
          {
            title: '💡 迭代敏捷：随时修改，即刻刷新可见',
            desc: '没有冗长的 build 等待，任何一处灵感改动只需在浏览器中按 Command+R，立等可验。'
          }
        ]
      }
    },
    5: {
      id: 5,
      ch: '05 / 05',
      title: '真实生活角',
      subtitle: '屏幕之外的生命张力，才是数字岛屿最底层的土壤',
      badge: 'Life & Humanity',
      quote: '“语言是全损压缩，技术是意图解压，而生活是唯一不失真的现场。”',
      output: {
        typeBadge: '01 看产物 · ARTIFACT',
        badgeClass: 'badge-output',
        headline: '手冲咖啡 / 法国金巴黎调酒 / 辩论与现实生活实践',
        summary: '技术人容易陷入代码的虚无，正是咖啡的温度、鸡尾酒的风味平衡与辩论队的辩证思维，赋予了 Finn 产品感知中最细腻的同理心。',
        stats: [
          { label: '专业资质', value: '法国金巴黎调酒资格认证' },
          { label: '手冲技艺', value: '100+ 杯浅烘风味图谱沉淀' },
          { label: '思辨历练', value: '多年高校辩论队正反方辩手' },
          { label: '生活理念', value: '真诚待人，绝不表演' }
        ],
        details: [
          {
            title: '法国金巴黎专业调酒资质认证',
            desc: '掌握经典鸡尾酒调制配比与风味结构，懂得在酒精、酸甜度与温度之间寻找极致的黄金平衡点。'
          },
          {
            title: '手冲单品咖啡与风味轮感知训练',
            desc: '精确控制粉水比（1:15）、萃取水温（92℃）与注水扰动，从浅烘耶加雪菲的柑橘花香中体悟对微小变量的敏锐控制力。'
          },
          {
            title: '高校辩论队多年思辨训练',
            desc: '习惯从对立面审视既定真理，深谙“逻辑自洽”与“现实荒谬”的距离，拒绝盲从任何单一权威视角。'
          },
          {
            title: '真实生活中的具身经验',
            desc: '热爱陆冲、街头漫游与面对面对话，把鲜活的人类经验注入冷冰冰的代码与模型提示词中。'
          }
        ]
      },
      rework: {
        typeBadge: '02 看返工 · REWORK & FAILURES',
        badgeClass: 'badge-rework',
        headline: '告别教条：在反复翻车中找回手感',
        summary: '冲一杯好咖啡和写一段好代码一模一样：网上的神级参数永远救不了现实中的变量突变。',
        details: [
          {
            title: '❌ 痛点一：迷信网上所谓的“万能萃取参数”，冲出的咖啡又苦又涩',
            desc: '早期机械照搬网上视频的研磨度与注水手法，忽略了不同烘焙批次豆子的排气剧烈程度与水质硬度，导致经常过萃或萃取不足。'
          },
          {
            title: '🔧 返工修正：建立自己的萃取实验手账，以感官为唯一检验标准',
            desc: '记录超过百杯风味笔记，学会用眼睛观察咖啡粉排气鼓包的状态、用鼻子闻水流穿透的香气动态调整绕圈速度，把参数化为肌肉记忆。'
          },
          {
            title: '❌ 痛点二：调酒时过分注重“动作帅气”，导致酒体水感过重失衡',
            desc: '初学调酒时模仿网上的炫技摇壶，摇冰时间过长导致冰块过度碎裂融水，调制出的古典鸡尾酒骨架全无。'
          },
          {
            title: '🔧 返工修正：回归热力学常识，专注精准控温与注水稀释率',
            desc: '重新理解老冰块的硬度、摇荡时长与搅拌速度的物理本质，把每一杯饮品调制回归到“让人喝下去感觉被照顾”的本初目的。'
          }
        ]
      },
      tradeoff: {
        typeBadge: '03 看取舍 · TRADEOFFS & BOUNDARIES',
        badgeClass: 'badge-tradeoff',
        headline: '拒绝人设表演：生活是给自己的交代',
        summary: '在人人都在朋友圈和小红书营造人设的年代，保持不造作的真实是一种罕见的能力。',
        details: [
          {
            title: '⛔ 坚决不做：把爱好变成流量营销的浮夸道具',
            desc: '调酒、咖啡不是为了摆拍营造“精致小资”的虚伪人设。做一杯酒，是为了在深夜同朋友促膝长谈；冲一杯咖啡，是为了在晨光中唤醒清醒的思考。'
          },
          {
            title: '⛔ 坚决不做：逃避现实的技术纯粹主义',
            desc: '拒绝做一个只活在终端黑屏和推特信息流里的程序员。如果一个人不爱具体的人、不品尝具体的食物，那他做出来的 AI 产品也必然是冰冷而虚伪的。'
          },
          {
            title: '💡 价值坚持：保持真实，让热爱有回响',
            desc: '真诚地面对每一个真实存在的朋友，愿意倾听，愿意分享，做一个在现实世界中扎实生活的人。'
          },
          {
            title: '💡 生活与创作的互哺',
            desc: '技术负责解决问题的效率，生活负责界定什么问题值得被解决。'
          }
        ]
      }
    }
  };

  let currentArch = 1;
  let currentPersp = 'output';

  const theatreStage = document.getElementById('theatre-stage');
  const workshopStudio = document.getElementById('workshop-studio');
  const stageAllBtn = document.getElementById('stage-all-btn');
  const btnBackOverview = document.getElementById('btn-back-overview');
  const studioPrevBtn = document.getElementById('studio-prev-btn');
  const studioNextBtn = document.getElementById('studio-next-btn');

  function renderWorkshop(archId, perspKey = 'output') {
    const data = WORKSHOPS_DATA[archId];
    if (!data) return;
    currentArch = archId;
    currentPersp = perspKey;

    const chIndicator = document.getElementById('studio-ch-indicator');
    const currentTitle = document.getElementById('studio-current-title');
    if (chIndicator) chIndicator.textContent = data.ch;
    if (currentTitle) currentTitle.textContent = `${data.title} · ${data.badge}`;

    document.querySelectorAll('#persp-tabs .persp-tab').forEach((tab) => {
      if (tab.getAttribute('data-persp') === perspKey) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    const panel = document.getElementById('studio-display-panel');
    if (!panel) return;

    const content = data[perspKey];
    if (!content) return;

    let statsHtml = '';
    if (content.stats && content.stats.length > 0) {
      statsHtml = `
        <div class="panel-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin: 18px 0 22px 0;">
          ${content.stats.map(s => `
            <div class="stat-mini-card" style="background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
              <div style="font-size: 11px; font-family: var(--font-mono); color: var(--ink-muted); margin-bottom: 4px;">${s.label}</div>
              <div style="font-size: 15px; font-weight: 700; color: var(--ink);">${s.value}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let detailsHtml = '';
    if (content.details && content.details.length > 0) {
      detailsHtml = `
        <div class="panel-details-list">
          ${content.details.map(d => `
            <div class="detail-point-box">
              <div class="point-title">${d.title}</div>
              <div class="point-desc">${d.desc}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="panel-header-row">
        <span class="panel-badge ${content.badgeClass}">${content.typeBadge}</span>
        <span style="font-size: 12px; font-family: var(--font-mono); color: var(--ink-muted);">${data.badge}</span>
      </div>
      <h3 class="panel-title">${content.headline}</h3>
      <p class="panel-body">${content.summary}</p>
      ${statsHtml}
      ${detailsHtml}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <span style="font-family: var(--font-serif); font-size: 13px; font-style: italic; color: var(--ink-muted);">${data.quote}</span>
        <button class="btn btn-sm btn-secondary" type="button" id="btn-studio-discuss" data-discuss-topic="${data.title}">
          <span>和 Finn 探讨此现场 ↗</span>
        </button>
      </div>
    `;

    const discussBtn = document.getElementById('btn-studio-discuss');
    if (discussBtn) {
      discussBtn.addEventListener('click', () => {
        const topicInput = document.getElementById('visitor-topic');
        if (topicInput) {
          topicInput.value = `对【${data.title}】的实战细节很感兴趣，想交流下`;
          if (typeof updateCollabPreview === 'function') {
            updateCollabPreview();
          }
        }
        const collabSec = document.getElementById('collaborate');
        if (collabSec) {
          collabSec.scrollIntoView({ behavior: 'smooth' });
        }
        sfx.play('click');
      });
    }
  }

  function openWorkshop(archId = 1) {
    triggerHaptic(8);
    if (theatreStage) theatreStage.style.display = 'none';
    if (workshopStudio) {
      workshopStudio.style.display = 'block';
      workshopStudio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    renderWorkshop(archId, currentPersp);
    sfx.play('click');
  }

  function closeWorkshop() {
    triggerHaptic(8);
    if (workshopStudio) workshopStudio.style.display = 'none';
    if (theatreStage) {
      theatreStage.style.display = 'block';
      theatreStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    sfx.play('click');
  }

  document.querySelectorAll('.arch-door').forEach((door) => {
    door.addEventListener('click', () => {
      const archId = parseInt(door.getAttribute('data-arch'), 10) || 1;
      openWorkshop(archId);
    });
    door.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const archId = parseInt(door.getAttribute('data-arch'), 10) || 1;
        openWorkshop(archId);
      }
    });
  });

  if (btnBackOverview) {
    btnBackOverview.addEventListener('click', closeWorkshop);
  }

  if (stageAllBtn) {
    stageAllBtn.addEventListener('click', () => {
      if (workshopStudio && workshopStudio.style.display !== 'none') {
        closeWorkshop();
      } else {
        openWorkshop(currentArch || 1);
      }
    });
  }

  if (studioPrevBtn) {
    studioPrevBtn.addEventListener('click', () => {
      let prev = currentArch - 1;
      if (prev < 1) prev = 5;
      renderWorkshop(prev, currentPersp);
      sfx.play('click');
    });
  }

  if (studioNextBtn) {
    studioNextBtn.addEventListener('click', () => {
      let next = currentArch + 1;
      if (next > 5) next = 1;
      renderWorkshop(next, currentPersp);
      sfx.play('click');
    });
  }

  document.querySelectorAll('#persp-tabs .persp-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const p = tab.getAttribute('data-persp');
      if (p) {
        renderWorkshop(currentArch, p);
        sfx.play('click');
      }
    });
  });

  // --- 10. 项目筛选功能 (Filter Chips) ---
  const filterBtns = document.querySelectorAll('#work-filter-bar .filter-btn');
  const featuredCards = document.querySelectorAll('.featured-card');
  const workListItems = document.querySelectorAll('.work-list-item');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      sfx.play('click');

      featuredCards.forEach((card) => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });

      workListItems.forEach((item) => {
        const cat = item.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // --- 11. 手风琴折叠面板 (Smooth Accordions) ---
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        item.classList.toggle('active', !isActive);
        sfx.play('click');
      });
    }
  });

  // --- 12. 合作意向快速拼装器 (Collab Kickstart) ---
  const dirPills = document.querySelectorAll('#collab-direction-options .opt-pill');
  const visitorNameInput = document.getElementById('visitor-name');
  const visitorTopicInput = document.getElementById('visitor-topic');
  const previewTextEl = document.getElementById('builder-preview-text');
  const btnCopyCollab = document.getElementById('btn-copy-collab');

  let currentDir = '原型开发与网站';

  function updateCollabPreview() {
    if (!previewTextEl) return;
    const name = (visitorNameInput && visitorNameInput.value.trim()) || '朋友';
    const topic = (visitorTopicInput && visitorTopicInput.value.trim()) || '近期想探讨一个具体想法';
    previewTextEl.textContent = `嗨 Finn，我是${name}，在你的个人网站上看到了关于【${currentDir}】的内容，想和你聊聊：${topic}。方便时聊聊！`;
  }

  dirPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      dirPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentDir = pill.getAttribute('data-dir');
      sfx.play('click');
      updateCollabPreview();
    });
  });

  if (visitorNameInput) visitorNameInput.addEventListener('input', updateCollabPreview);
  if (visitorTopicInput) visitorTopicInput.addEventListener('input', updateCollabPreview);

  if (btnCopyCollab && previewTextEl) {
    btnCopyCollab.addEventListener('click', () => {
      copyText(previewTextEl.textContent.trim(), '沟通文案已复制，可直接发送！');
    });
  }

  // --- 13. 微信二维码全屏 Lightbox 弹窗 ---
  const qrImgContainer = document.getElementById('qr-img-container');
  const qrModal = document.getElementById('qr-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  function openQrModal() {
    if (qrModal) {
      qrModal.classList.add('open');
      sfx.play('click');
    }
  }

  function closeQrModal() {
    if (qrModal) {
      qrModal.classList.remove('open');
      sfx.play('click');
    }
  }

  if (qrImgContainer) qrImgContainer.addEventListener('click', openQrModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeQrModal);
  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) closeQrModal();
    });
  }
  // --- 13.1 登岛航线票根弹窗 (Boarding Pass Ticket Modal) ---
  const ticketModal = document.getElementById('ticket-modal');
  const ticketCloseBtn = document.getElementById('ticket-close-btn');
  const boardingTicketBtn = document.getElementById('boarding-ticket-btn');
  const heroTicketBtn = document.getElementById('btn-hero-ticket');

  function openTicketModal() {
    triggerHaptic(12);
    if (ticketModal) {
      ticketModal.classList.add('open');
      ticketModal.setAttribute('aria-hidden', 'false');
      sfx.play('click');
    }
  }

  function closeTicketModal() {
    triggerHaptic(8);
    if (ticketModal) {
      ticketModal.classList.remove('open');
      ticketModal.setAttribute('aria-hidden', 'true');
      sfx.play('click');
    }
  }

  if (boardingTicketBtn) boardingTicketBtn.addEventListener('click', openTicketModal);
  if (heroTicketBtn) heroTicketBtn.addEventListener('click', openTicketModal);
  if (ticketCloseBtn) ticketCloseBtn.addEventListener('click', closeTicketModal);
  if (ticketModal) {
    ticketModal.addEventListener('click', (e) => {
      if (e.target === ticketModal) closeTicketModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (qrModal && qrModal.classList.contains('open')) closeQrModal();
      if (ticketModal && ticketModal.classList.contains('open')) closeTicketModal();
    }
  });

  // --- 14. 动态 Canvas 呼吸波纹与微光星尘背景 ---
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let mouse = { x: -1000, y: -1000 };
    let animFrame;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    }

    function initParticles() {
      particles = [];
      const count = Math.floor(Math.min(width, height) / 28);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.6 + 0.6,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          alpha: Math.random() * 0.5 + 0.2
        });
      }
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    let time = 0;
    function render() {
      ctx.clearRect(0, 0, width, height);
      const isDark = htmlRoot.getAttribute('data-theme') === 'dark';
      time += 0.008;

      // 绘制轻柔流动波纹（象征岛屿海岸潮汐）
      ctx.beginPath();
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        ctx.moveTo(0, height * 0.7 + w * 40);
        for (let x = 0; x <= width; x += 40) {
          const waveY =
            height * 0.65 +
            Math.sin(x * 0.002 + time + w) * 35 +
            Math.cos(x * 0.001 - time * 0.8) * 20 +
            w * 40;
          ctx.lineTo(x, waveY);
        }
      }
      ctx.strokeStyle = isDark ? 'rgba(242, 106, 68, 0.04)' : 'rgba(217, 83, 47, 0.035)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 绘制微光漂移星尘
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // 鼠标附近微斥力
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.x -= (dx / dist) * 1.5;
          p.y -= (dy / dist) * 1.5;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(242, 106, 68, ${p.alpha * 0.7})`
          : `rgba(217, 83, 47, ${p.alpha * 0.45})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(render);
    }

    resize();
    render();

    // 页面不可见时暂停动画以节省电量
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrame);
      } else {
        render();
      }
    });
  }
})();
