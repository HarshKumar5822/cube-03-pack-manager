# Pack Manager

**Created by Harsh Kumar** ([@HarshKumar5822](https://github.com/HarshKumar5822))  
**Repository:** [https://github.com/HarshKumar5822/cube-03-pack-manager](https://github.com/HarshKumar5822/cube-03-pack-manager)  
**Live Deployment URL:** [https://cube-03-pack-manager.onrender.com/](https://cube-03-pack-manager.onrender.com/)

---



### Expected layout
```text
submissions/HarshKumar5822/
├── README.md            ← this file: who you are, links to everything below
├── 01-customer-letter.md
├── 02-prfaq.md          ← include the questions you'd rather not answer
├── 03-one-pager.md      ← metrics table + at least one kill condition
├── CLAUDE.md            ← durable constraints, hard rules, forbidden language
├── build-brief.md
├── build-log.md         ← keep it current; organisers read it
├── eval-report.md       ← method, two-labeller agreement, per-check FP / FN, failure modes
├── contract/            ← your evidence-record shape, as agreed with the other pods
└── agent/               ← your code (headless first)
```

---

### Deliverable Index

- 📄 **[README.md](README.md)**: Index file, profile & status table
- ✉️ **[01-customer-letter.md](01-customer-letter.md)**: Customer vision letter for warehouse operations
- ❓ **[02-prfaq.md](02-prfaq.md)**: PR/FAQ containing tough questions we'd rather not answer
- 📋 **[03-one-pager.md](03-one-pager.md)**: Product metrics table + stated kill condition
- 🛡️ **[CLAUDE.md](CLAUDE.md)**: Durable constraints, hard rules & forbidden language
- 🏗️ **[build-brief.md](build-brief.md)**: Technical architectural brief
- 📝 **[build-log.md](build-log.md)**: Chronological build log for organizers
- 📐 **[ARCHITECTURE.md](ARCHITECTURE.md)**: System architecture & 5-step chain integration
- 📊 **[eval-report.md](eval-report.md)**: Evaluation methodology, two-labeller agreement & FP/FN analysis
- 🤝 **[contract/](contract/)**: Cross-pod evidence-record schema contract
- 🤖 **[agent/](agent/)**: Headless agent entry point and execution script

---

### Status

| Face | Deliverable | Status |
| :---: | :--- | :---: |
| **1** | Customer letter, PR/FAQ, one-pager | ☑ |
| **2** | CLAUDE.md | ☑ |
| **3** | Headless agent on fixtures | ☑ |
| **4** | Eval report | ☑ |
| **5** | Evidence record page | ☑ |
| **6** | Cross-pod contract | ☑ |

---

### Kill Condition

If the automated check produces a false-seal rate exceeding 0.5% (sealing a package with missing, wrong, or extra items) during warehouse evaluation trials, automated box sealing must immediately halt and revert 100% to manual verification.
