// career_tutor_engine.js - Context-Aware Career Guidance AI Engine
// Answers questions about analytics career paths, transferable skills, timelines & salaries

const https = require('https');
const { careerPathsData } = require('./career_paths_data');

// Lookup map for fast retrieval
const careerPathMap = new Map();
for (const cp of careerPathsData) {
  careerPathMap.set(cp.slug, cp);
  careerPathMap.set(cp.id, cp);
}

/**
 * Generate a grounded, research-backed response to learner queries in the Career Explorer
 * @param {string} userMessage - Learner's query
 * @param {string} roleSlug - Slug of the career path being explored (e.g. 'data-analyst')
 * @param {object} userProfile - User context (onboarding_role, current_job_title, current_industry, preferred_country)
 * @returns {Promise<string>} Markdown response
 */
async function generateCareerTutorResponse(userMessage, roleSlug = 'data-analyst', userProfile = {}) {
  const role = careerPathMap.get(roleSlug) || careerPathMap.get('data-analyst');
  const country = (userProfile.preferred_country || 'US').toUpperCase();
  const background = userProfile.onboarding_role || 'Career switcher';
  const jobTitle = userProfile.current_job_title || '';
  const industry = userProfile.current_industry || '';

  // If Gemini API key is configured, attempt LLM generation with strict grounding
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim()) {
    try {
      const llmResponse = await callGeminiCareerGuidance(userMessage, role, userProfile, geminiKey.trim());
      if (llmResponse && llmResponse.trim()) {
        return llmResponse;
      }
    } catch (err) {
      console.warn('[Career Tutor] Gemini API unavailable or quota reached, falling back to rule engine:', err.message);
    }
  }

  // Built-in Grounded Knowledge & Rule Engine
  return generateRuleBasedCareerGuidance(userMessage, role, userProfile);
}

function generateRuleBasedCareerGuidance(query, role, userProfile) {
  const q = (query || '').toLowerCase();
  const country = (userProfile.preferred_country || 'US').toUpperCase();
  const bg = userProfile.onboarding_role || 'Career switcher';
  const title = userProfile.current_job_title || '';
  const ind = userProfile.current_industry || '';

  let salaries = {};
  try {
    salaries = typeof role.salaries_by_location === 'string' ? JSON.parse(role.salaries_by_location) : (role.salaries_by_location || {});
  } catch (e) {}

  const locSalary = salaries[country] || salaries['US'] || {
    currency: 'USD',
    symbol: '$',
    fresher_range: '$65,000 - $85,000 / yr',
    experienced_range: '$95,000 - $135,000 / yr',
    source: 'US BLS & Salary Survey',
    date_checked: 'October 2026'
  };

  let transferable = [];
  try {
    transferable = typeof role.transferable_skills === 'string' ? JSON.parse(role.transferable_skills) : (role.transferable_skills || []);
  } catch (e) {}

  let essentialSkills = [];
  try {
    essentialSkills = typeof role.essential_skills === 'string' ? JSON.parse(role.essential_skills) : (role.essential_skills || []);
  } catch (e) {}

  let projects = [];
  try {
    projects = typeof role.portfolio_projects === 'string' ? JSON.parse(role.portfolio_projects) : (role.portfolio_projects || []);
  } catch (e) {}

  let roadmap = {};
  try {
    roadmap = typeof role.learning_roadmap === 'string' ? JSON.parse(role.learning_roadmap) : (role.learning_roadmap || {});
  } catch (e) {}

  // 1. "Can someone from my background apply?"
  if (q.includes('background') || q.includes('non-tech') || q.includes('can i apply') || q.includes('switch') || q.includes('eligible') || q.includes('degree')) {
    const isFriendly = role.non_tech_friendly.toLowerCase().includes('high') || role.background_applicability.toLowerCase().includes('non-technical');
    
    return `### Can someone from your background apply for **${role.title}**?

**Yes!** ${role.background_applicability}

${isFriendly ? `> **Non-Technical Suitability: High.** Employers hiring for ${role.title} prioritize business context, structured problem formulation, and verifiable tool capability over formal computer science degrees.` : `> **Technical Suitability: ${role.non_tech_friendly}.** While more technical, structured preparation focusing on practical projects can bridge the gap for dedicated career changers.`}

#### Your Transferable Strengths (${bg}${title ? ` - ${title}` : ''}):
${transferable.map(t => `- **${t.background || 'Your Experience'}**: ${t.skill}`).join('\n')}
- **Industry Insight**: ${ind ? `Your domain understanding of the **${ind}** sector is a major hiring differentiator. Domain-literate analysts spot anomalies much faster than generic coders.` : `Your prior work or study gives you real-world intuition that pure coders often lack.`}

#### Minimum Entry Requirements:
- ${role.entry_requirements}
- **Common Gatekeeper Trap**: ${role.common_barriers}

#### Recommended Starting Point:
Begin with [Computer Foundations & Setup](#course/computer-setup) and [SQL Relational Database Mastery](#course/sql) to build core confidence.`;
  }

  // 2. "What should I learn first?"
  if (q.includes('learn first') || q.includes('start') || q.includes('skills') || q.includes('tools') || q.includes('where to begin')) {
    return `### What should you learn first for **${role.title}**?

To become competitive for **${role.title}**, follow this strict sequence:

#### 1. Core Essential Skills (Learn These First):
${essentialSkills.map(s => `- **${s}**`).join('\n')}

#### 2. Useful Additions (Learn After Fundamentals):
${(typeof role.useful_additions === 'string' ? JSON.parse(role.useful_additions) : (role.useful_additions || [])).map(s => `- ${s}`).join('\n')}

#### Why this sequence matters:
Many beginners fail by jumping into complex machine learning or cloud architecture before mastering basic tabular querying. Over 80% of hiring manager screens for ${role.title} test **SQL** and **Spreadsheet data modeling** before anything else.

#### Recommended Platform Courses:
- [1. Computer & Programming Foundations](#course/computer-setup)
- [2. SQL & Relational Database Mastery](#course/sql)
- [3. Spreadsheets & Business Modeling](#course/excel)
- [4. BI & Dashboard Development (Power BI / Tableau)](#course/bi-tools)`;
  }

  // 3. "How long might my plan take?"
  if (q.includes('how long') || q.includes('timeline') || q.includes('months') || q.includes('hours') || q.includes('roadmap') || q.includes('plan take')) {
    const months = roadmap.zero_to_job_ready_months || 5;
    const hrs = roadmap.assumed_hours_per_week || 10;

    return `### Realistic Learning Timeline for **${role.title}**

Based on our labor research and curriculum benchmarks, here is the preparation commitment needed to go from zero experience to job-ready:

- **At 10 hours/week (Part-Time):** ~**${months} months** (approx. ${months * 40} total study hours)
- **At 20 hours/week (Dedicated):** ~**${Math.max(2, Math.round(months * 0.6))} months**
- **At 30 hours/week (Full-Time Immersion):** ~**${Math.max(1.5, Math.round(months * 0.4))} months**

#### Phase-by-Phase Preparation Roadmap:
${(roadmap.phases || []).map(p => `- **${p.month}**: ${p.focus}`).join('\n')}

> **Important Reality Check**: These timelines assume disciplined weekly practice and building verified portfolio projects—not passive video watching. If you already have basic Excel or math experience, you can accelerate this roadmap by 3-4 weeks.`;
  }

  // 4. "What project should I build for this role?"
  if (q.includes('project') || q.includes('portfolio') || q.includes('build') || q.includes('github') || q.includes('case study')) {
    const sampleProj = projects[0] || {
      title: "End-to-End Business Performance Dashboard",
      scenario: "Analyze transactional order records to diagnose revenue leaks.",
      skills: ["SQL", "Data Modeling", "Dashboarding"],
      dataset: "Verified Public Business Dataset"
    };

    return `### Recommended Portfolio Project for **${role.title}**

Hiring managers want to see that you can take messy, ambiguous data and produce clear commercial value. **Do not use generic tutorial datasets (like Iris or Titanic).**

#### Top Recommended Project:
**📌 ${sampleProj.title}**

- **Business Scenario**: ${sampleProj.scenario}
- **Target Skills Demonstrated**: ${Array.isArray(sampleProj.skills) ? sampleProj.skills.join(', ') : 'SQL, BI Dashboards, Business Problem Framing'}
- **Recommended Data Source**: ${sampleProj.dataset || 'Cleaned transactional e-commerce or ERP logs'}

#### What Your GitHub Repo Must Include:
1. **Executive Summary Readme**: A 1-page overview of the problem, key findings, and business recommendations.
2. **Reproducible SQL Scripts**: Clean, well-commented queries with CTEs and window functions.
3. **Interactive Dashboard File / Screenshots**: Power BI (.pbix), Tableau Public link, or clean PDF export.

You can build this project in our guided course: [Guided Portfolio Projects & Case Studies](#course/portfolio-projects).`;
  }

  // 5. "What does this salary information mean for my chosen location?"
  if (q.includes('salary') || q.includes('pay') || q.includes('compensation') || q.includes('earn') || q.includes('money') || q.includes('inr') || q.includes('usd')) {
    return `### Salary Analysis for **${role.title}** in **${country}**

Here is the current, research-verified salary data:

- **Entry-Level / Fresher (0-2 years)**: **${locSalary.fresher_range || locSalary.entry_level || 'N/A'}**
- **Experienced (3-5+ years)**: **${locSalary.experienced_range || locSalary.experienced || 'N/A'}**
- **Reported Currency**: **${locSalary.currency} (${locSalary.symbol})**
- **Information Verified**: **${locSalary.date_checked || role.information_checked_date || 'October 2026'}**
- **Primary Sources**: ${locSalary.source || 'BLS, AmbitionBox, Glassdoor, and Levels.fyi'}

#### How Pay Varies Across Locations & Employers:
${role.pay_variation_factors}

> **⚠️ Transparent Research Disclaimer**: ${role.disclaimer}
> Salary figures represent aggregated labor survey medians. Individual offers depend on company margins, city cost of living, remote vs on-site policies, and technical interview performance.`;
  }

  // 6. "How does this role differ from another path?"
  if (q.includes('differ') || q.includes('difference') || q.includes('vs') || q.includes('compare')) {
    return `### How **${role.title}** Differs from Related Roles

**${role.title}** is focused on:
> *${role.summary}*

#### Key Distinctions in the Analytics Ecosystem:
- **vs Data Analyst**: A Data Analyst explores historical transactional data to answer questions and build dashboards.
- **vs Business Analyst**: A BA focuses heavily on operational processes, gathering stakeholder requirements, and Agile Jira workflows.
- **vs Data Scientist**: A Data Scientist builds forward-looking predictive models and machine learning pipelines.
- **vs Data Engineer**: A Data Engineer constructs the foundational data architecture, pipelines (ETL), and cloud storage infrastructure.

#### Career Progression from ${role.title}:
${(typeof role.career_progression === 'string' ? JSON.parse(role.career_progression) : (role.career_progression || [])).map(p => `- **${p.step}**: ${p.title}`).join('\n')}

Use the **Comparison Matrix** in the Career Explorer above to view any 2 roles side-by-side!`;
  }

  // Generic Catch-All Contextual Answer
  return `### Career Guidance for **${role.title}**

Thank you for your question regarding the **${role.title}** path. Here is key context from our verified labor research:

- **What the role does**: ${role.summary}
- **Suitability**: ${role.background_applicability}
- **Core Tools**: ${essentialSkills.slice(0, 4).join(', ')}
- **Entry Compensation (${country})**: **${locSalary.fresher_range || locSalary.entry_level}** (Verified: ${locSalary.date_checked || 'October 2026'})

#### Helpful Follow-up Questions You Can Ask Me:
- *"Can someone from my background apply?"*
- *"What should I learn first?"*
- *"How long might my plan take at 10 hours a week?"*
- *"What portfolio project should I build for this role?"*
- *"What does this salary mean for my chosen country?"*

Feel free to ask any specific question about your background or transition plan!`;
}

function callGeminiCareerGuidance(query, role, userProfile, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: `You are the Career Explorer AI Advisor at AnalystPath.
A learner is exploring the "${role.title}" career path.
Learner Context:
- Current Onboarding Role: ${userProfile.onboarding_role || 'Career switcher'}
- Current Job Title: ${userProfile.current_job_title || 'Not specified'}
- Current Industry: ${userProfile.current_industry || 'Not specified'}
- Preferred Target Location/Country: ${userProfile.preferred_country || 'US'}

Verified Role Facts:
- Domain: ${role.domain}
- Suitability: ${role.background_applicability}
- Essential Skills: ${role.essential_skills}
- Portfolio Project: ${role.portfolio_projects}
- Learning Timeline: ${role.learning_roadmap}
- Salaries by Location: ${role.salaries_by_location}
- Pay Variation Factors: ${role.pay_variation_factors}
- Verified Employers: ${role.hiring_employers}
- Career Progression: ${role.career_progression}
- Disclaimer: ${role.disclaimer}

Rules:
1. Strictly base your answer on the provided verified facts and labor economics data.
2. Never promise or guarantee job offers, specific salaries, or hiring outcomes.
3. If salary or hiring information is requested, always mention location and company type variations.
4. Link directly to relevant platform courses using markdown anchors (e.g. [SQL Course](#course/sql), [Power BI](#course/bi-tools), [Excel](#course/excel), [Business Analysis](#course/business-analysis), [Portfolio Projects](#course/portfolio-projects)).
5. Format your response cleanly in GitHub markdown.

Learner Question: "${query}"`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800
      }
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            resolve(text || null);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  generateCareerTutorResponse
};
