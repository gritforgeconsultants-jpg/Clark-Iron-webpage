# Clark Iron Erectors Homepage - Setup Instructions

## 🎯 Overview
Commercial-focused homepage for Clark Iron Erectors Inc, built for General Contractors and commercial construction professionals.

## 📁 File Structure
Clark-Iron-webpage/
├── index.html # Main homepage (7-section structure)
├── css/
│ └── styles.css # All styling with hero background treatment
├── js/
│ └── main.js # Interactive features (smooth scroll, nav states)
├── images/
│ └── crane-precast-hero.jpg # ⚠️ REQUIRED: Your crane/precast background image
├── SETUP.md # This file
└── README.md # Project description

## 🚀 Quick Start

### Step 1: Add Your Hero Background Image
1. **CRITICAL**: Save your crane/precast jobsite photo as `crane-precast-hero.jpg`
2. Place it in the `images/` folder
3. The CSS is already configured to use this file at: `css/styles.css:167`

**Image path in CSS:**
```css
background-image: url('../images/crane-precast-hero.jpg');

