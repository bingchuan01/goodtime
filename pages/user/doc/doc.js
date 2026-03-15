// 通用文档页（关于我们、隐私协议、用户协议、第三方信息共享清单），内容优先从后台配置拉取
const api = require('../../../utils/api');

const TYPE_TO_KEY = {
  about: 'about_doc',
  privacy: 'privacy_doc',
  'user-agreement': 'user_agreement_doc',
  'third-party': 'third_party_doc'
};

const DEFAULT_MAP = {
  about: {
    title: '关于我们',
    content: '<p><strong>好时机</strong></p><p>好时机是一款加盟项目发布与展示平台，致力于为用户提供优质的商业项目信息与会员服务。</p><p><strong>联系我们</strong></p><p>如有疑问或建议，请通过小程序内客服功能联系我们。</p><p>以上内容由官方后台编辑维护。</p>'
  },
  privacy: {
    title: '隐私协议',
    content: '<p><strong>隐私政策</strong></p><p>我们高度重视您的隐私保护。本协议说明我们如何收集、使用、存储和保护您的个人信息。</p><p><strong>一、信息收集</strong></p><p>我们可能收集的信息包括：手机号、昵称、头像、设备信息等，用于账号注册、身份验证及服务提供。</p><p><strong>二、信息使用</strong></p><p>您的信息将用于账号管理、会员服务、内容推荐及安全保障，不会用于其他未经您同意的用途。</p><p><strong>三、信息保护</strong></p><p>我们采取合理的技术与管理措施保护您的个人信息安全。</p><p><strong>四、信息共享</strong></p><p>未经您同意，我们不会向第三方出售或转让您的个人信息。详见《第三方信息共享清单》。</p><p>以上内容由官方后台编辑维护。</p>'
  },
  'user-agreement': {
    title: '用户协议',
    content: '<p><strong>用户服务协议</strong></p><p>欢迎使用好时机平台服务。使用前请您仔细阅读本协议。</p><p><strong>一、服务内容</strong></p><p>平台提供项目展示、发布、会员权益等服务，具体以平台公示为准。</p><p><strong>二、用户义务</strong></p><p>您应遵守法律法规及平台规则，不得发布违法违规内容。平台有权对违规内容进行处理。</p><p><strong>三、知识产权</strong></p><p>平台内容（除用户发布外）的知识产权归平台或相关权利人所有。</p><p><strong>四、免责声明</strong></p><p>用户发布的内容由发布者承担责任，平台仅提供信息展示服务。</p><p>以上内容由官方后台编辑维护。</p>'
  },
  'third-party': {
    title: '第三方信息共享清单',
    content: '<p><strong>第三方信息共享清单</strong></p><p>为向您提供完整服务，我们可能与以下第三方共享必要信息：</p><p><strong>一、微信</strong></p><p>用途：微信登录、支付。共享信息：openid、昵称、头像。详见微信隐私政策。</p><p><strong>二、云存储服务</strong></p><p>用途：文件存储、CDN 加速。共享信息：您上传的图片、视频等文件。</p><p><strong>三、统计分析</strong></p><p>用途：数据分析、产品优化。共享信息：设备信息、使用行为等匿名化数据。</p><p>以上第三方均遵循相关法律法规及隐私政策要求。具体清单以平台公示为准，由官方后台编辑维护。</p>'
  }
};

Page({
  data: {
    title: '',
    content: ''
  },

  async onLoad(options) {
    const type = options.type || 'about';
    const item = DEFAULT_MAP[type] || DEFAULT_MAP.about;
    const configKey = TYPE_TO_KEY[type] || TYPE_TO_KEY.about;
    this.setData({ title: item.title, content: item.content });
    try {
      const content = await api.getConfig(configKey);
      if (content && typeof content === 'string' && content.trim()) {
        this.setData({ content: content.trim() });
      }
    } catch (e) {}
  }
});
