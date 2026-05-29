// project-card.js
const COVER_PLACEHOLDER = '/images/placeholder.svg';
const memberUtil = require('../../utils/member');

Component({
  properties: {
    project: {
      type: Object,
      value: {}
    }
  },
  data: {
    displayCoverUrl: COVER_PLACEHOLDER,
    memberBadgeClass: ''
  },
  observers: {
    project(project) {
      const url = project && project.coverUrl ? String(project.coverUrl).trim() : '';
      const lvl = project && project.memberLevel;
      this.setData({
        displayCoverUrl: url || COVER_PLACEHOLDER,
        memberBadgeClass: memberUtil.getMemberBadgeClass(lvl)
      });
    }
  },
  methods: {
    onCoverError() {
      this.setData({ displayCoverUrl: COVER_PLACEHOLDER });
    },
    onCardTap() {
      const projectId = this.data.project.id
      const project = this.data.project
      this.triggerEvent('tap', {
        projectId: projectId,
        project: project
      })
      // 跳转由首页 onProjectTap 统一处理，避免重复 push 导致两个详情页叠加
    }
  }
})
