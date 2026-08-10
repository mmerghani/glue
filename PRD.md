The Glue PRD  

# Glue – Claude Code UI replacement . Run claude code locally  
 
## Overview 
Glue is a one-command installer that sets up a complete local AI development environment. It glues together: 
- CloudCLI (rebranded as Glue UI) https://github.com/siteboon/claudecodeui Claude Code CLI 
- vllm-mlx with Gemma-4-E4B 
 
## User Experience 
1. User runs: `curl -fsSL https://glue.dev/install | bash` 
2. Everything installs automatically 
3. User can: 
  - Run `glue cli` in any project for terminal coding 
  - Launch `Glue.app` for desktop UI 
  - Run `glue ui` to open web UI 
 
## Project Structure 
 

glue/ ├── install.sh # Master installer ├── uninstall.sh # Clean removal ├── scripts/ │ ├── check-system.sh │ ├── install-claude-code.sh │ ├── install-vllm-mlx.sh │ ├── download-model.sh │ └── create-launchers.sh ├── launchers/ │ ├── glue # Main CLI │ └── glue-cli # Terminal mode ├── docs/ │ ├── INSTALL.md │ └── TROUBLESHOOTING.md └── desktop-app/ # Forked CloudCLI (rebranded to Glue) 

 
## Commands 
- `glue cli` - Launch Claude Code in current dir 
- `glue ui` - Open Glue Desktop/Web UI 
- `glue status` - Check all components 
- `glue model` - Switch models 
- `glue update` - Update everything 
 
## Branding 
- Name: Glue 
- Logo: A glue bottle or puzzle piece 
- Colors: #6C63FF (purple) and #00D4FF (cyan) 
- Tagline: "The Local AI Coding Assistant" 
- One-liner: "One command. Everything local. No cloud." 
 
## License 
AGPL-3.0 (inherited from CloudCLI) 
 
## Deliverables 
1. install.sh - Master installer 
2. All helper scripts 
3. Launcher scripts 
4. Documentation 
5. Branding assets 
6. Fork CloudCLI and rebrand to Glue 
7. Build DMG for distribution 
 
## Success Criteria 
- [ ] One command installs everything 
- [ ] `glue cli` works in any project 
- [ ] Glue.app opens and connects to local server 
- [ ] Model downloads and runs 
- [ ] Tool calling works 
- [ ] User can switch models 
- [ ] Update command works 
 

 

Step 3: Give it the PRD 

I want to build Glue according to this PRD. Please build the complete project structure, installer scripts, and launchers. Start with the core scripts and we'll test each one as we go. 
 

💡 Tips for Success 

One piece at a time - Have it build install.sh first, test it, then move to the next script 

Test frequently - After each component, run it to make sure it works 

Use the existing scripts - We already have working scripts from earlier; Claude Code can use those as references 

Keep the PRD open - Reference it throughout the build 

 

🚀 