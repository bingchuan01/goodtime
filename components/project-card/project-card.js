// project-card.js
const COVER_PLACEHOLDER = '/images/placeholder.svg';
const memberUtil = require('../../utils/member');

function formatCount(n) {
  const v = Number(n) || 0;
  if (v >= 10000) {
    const wan = v / 10000;
    return (wan >= 10 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')) + '万';
  }
  if (v >= 1000) {
    const qian = v / 1000;
    return (qian >= 10 ? Math.round(qian) : qian.toFixed(1).replace(/\.0$/, '')) + '千';
  }
  return String(v);
}

function buildViewLabel(project) {
  if (!project) return '';
  if (project.viewLabel) return String(project.viewLabel);
  return `${formatCount(project.viewCount)}观看`;
}

Component({
  properties: {
    project: {
      type: Object,
      value: {}
    }
  },
  data: {
    displayCoverUrl: COVER_PLACEHOLDER,
    memberBadgeClass: '',
    algoTag: null,
    algoTagClass: '',
    viewLabel: ''
  },
  observers: {
    project(project) {
      const url = project && project.coverUrl ? String(project.coverUrl).trim() : '';
      const lvl = project && project.memberLevel;
      const algoTag = (project && project.algoTag) || null;
      const viewLabel = buildViewLabel(project);
      this.setData({
        displayCoverUrl: url || COVER_PLACEHOLDER,
        memberBadgeClass: memberUtil.getMemberBadgeClass(lvl),
        algoTag,
        algoTagClass: algoTag && algoTag.type === 'surge' ? 'algo-surge' : 'algo-metric',
        viewLabel
      });
    }
  },
  methods: {
    onCoverError() {
      this.setData({ displayCoverUrl: COVER_PLACEHOLDER });
    },
    onCardTap() {
      const projectId = this.data.project.id;
      const project = this.data.project;
      this.triggerEvent('tap', {
        projectId: projectId,
        project: project
      });
    }
  }
});
