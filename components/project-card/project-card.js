// project-card.js
Component({
  properties: {
    project: {
      type: Object,
      value: {}
    }
  },
  data: {
    
  },
  methods: {
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
