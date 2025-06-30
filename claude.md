# ClaudeBuilder Development Instructions

## Project Configuration
- **Name**: ${PROJECT_NAME}
- **Type**: ${PROJECT_TYPE} 
- **Complexity**: ${COMPLEXITY}

## Development Guidelines

Build ${PROJECT_NAME} as a ${COMPLEXITY} complexity ${PROJECT_TYPE} project.

### ${COMPLEXITY} Complexity Rules:
$(if [[ "$COMPLEXITY" == "minimal" ]]; then
    echo "- Timeline: 1-3 hours maximum"
    echo "- Core functionality only"
    echo "- Simple tech stack"
    echo "- No authentication required"
elif [[ "$COMPLEXITY" == "standard" ]]; then
    echo "- Timeline: 1-3 days maximum"
    echo "- Production-ready features"
    echo "- Modern tech stack"
    echo "- Basic authentication"
    echo "- Docker deployment"
else
    echo "- Timeline: 1-2 weeks maximum"
    echo "- Enterprise features"
    echo "- Microservices architecture"
    echo "- Advanced security"
fi)

### Development Commands:
"Implement feature: [description] for ${PROJECT_NAME} following ${COMPLEXITY} complexity guidelines"

"Add comprehensive testing with proper error handling"

"Deploy to staging environment with monitoring"

### Success Criteria:
- All features working as specified
- Comprehensive error handling
- Security best practices
- Documentation complete
- Deployment ready

**Stay within ${COMPLEXITY} complexity scope to avoid feature creep.**
