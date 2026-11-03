// test_career_and_profile.js - In-Memory End-to-End Test Suite
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./database');
const server = require('./server');

const db = getDb();

function request(method, urlPath, body = null, token = null) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = {
      'content-type': 'application/json',
      'host': 'localhost:3000'
    };
    if (token) headers['authorization'] = `Bearer ${token}`;
    if (body) headers['content-length'] = Buffer.byteLength(bodyStr);

    const req = new Readable({
      read() {
        if (bodyStr) {
          this.push(Buffer.from(bodyStr));
        }
        this.push(null);
      }
    });
    req.url = urlPath;
    req.method = method;
    req.headers = headers;
    req.socket = { remoteAddress: '127.0.0.1' };

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = new EventEmitter();
    res.writeHead = (status, h = {}) => {
      statusCode = status;
      Object.assign(resHeaders, h);
    };
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.write = (chunk) => { if (chunk) chunks.push(Buffer.from(chunk)); };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const resBodyStr = Buffer.concat(chunks).toString('utf8');
      let parsedData = null;
      try {
        parsedData = JSON.parse(resBodyStr);
      } catch (e) {
        parsedData = resBodyStr;
      }
      resolve({ status: statusCode, headers: resHeaders, data: parsedData });
    };

    server.emit('request', req, res);
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CAREER EXPLORER & PROFILE VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Config endpoint
    console.log('[Test 1] Public System Configuration');
    const cfg = await request('GET', '/api/config');
    assert(cfg.status === 200, 'Config returns 200 OK');
    assert(cfg.data.appName, `App Name: ${cfg.data.appName}`);

    // 2. Register Learner A
    console.log('\n[Test 2] Registration & Initial Profile');
    const emailA = `learnerA_${Date.now()}@example.com`;
    const regA = await request('POST', '/api/auth/register', {
      name: 'Priya Sharma',
      email: emailA,
      password: 'Password123!'
    });
    assert(regA.status === 201, 'Learner A registered');
    const tokenA = regA.data.token;
    assert(regA.data.user.onboarding_role === 'Career switcher', 'Default onboarding role is Career switcher');
    assert(regA.data.user.share_phone === 0, 'Phone sharing disabled by default');
    assert(regA.data.user.share_profile_photo === 0, 'Photo sharing disabled by default');

    // 3. Onboarding update with Employed Role & details
    console.log('\n[Test 3] Onboarding Flow (Role Question & Employer Details)');
    const obA = await request('POST', '/api/onboarding', {
      onboarding_role: 'Employed',
      current_job_title: 'Senior Operations Executive',
      current_industry: 'Logistics & Supply Chain',
      preferred_country: 'IN',
      current_level: 'Career Switcher',
      target_role: 'Operations Analyst',
      preferred_language: 'hinglish',
      hours_per_week: 15
    }, tokenA);
    assert(obA.status === 200, 'Onboarding submitted');
    assert(obA.data.user.onboarding_role === 'Employed', 'Role updated to Employed');
    assert(obA.data.user.current_job_title === 'Senior Operations Executive', 'Job title stored');
    assert(obA.data.user.current_industry === 'Logistics & Supply Chain', 'Industry stored');
    assert(obA.data.user.preferred_country === 'IN', 'Preferred country is IN');

    // 4. Base64 Profile Photo Upload
    console.log('\n[Test 4] Secure Profile Photo Upload & Storage');
    const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const photoUpload = await request('POST', '/api/user/profile-photo', {
      photo: samplePngBase64
    }, tokenA);
    assert(photoUpload.status === 200, 'Profile photo upload succeeded');
    assert(photoUpload.data.profile_photo.startsWith('/uploads/avatars/avatar_'), 'Photo stored in /uploads/avatars/');

    const diskPath = path.join(__dirname, 'public', photoUpload.data.profile_photo.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), 'Physical avatar file created on disk');

    // 5. Phone Verification SMS Flow
    console.log('\n[Test 5] SMS Phone Verification');
    const sendCodeRes = await request('POST', '/api/user/phone/send-code', {
      phone: '+91 9876543210'
    }, tokenA);
    assert(sendCodeRes.status === 200, 'SMS verification code dispatched');
    const smsCode = sendCodeRes.data.code;
    assert(smsCode && smsCode.length === 6, 'Generated 6-digit SMS code');

    const verifyCodeRes = await request('POST', '/api/user/phone/verify-code', {
      code: smsCode
    }, tokenA);
    assert(verifyCodeRes.status === 200, 'Phone verified successfully');

    const meA = await request('GET', '/api/auth/me', null, tokenA);
    assert(meA.data.user.is_phone_verified === 1, 'is_phone_verified is 1');
    assert(meA.data.user.phone === '+91 9876543210', 'Phone number saved');
    assert(meA.data.user.profile_photo === photoUpload.data.profile_photo, 'Profile photo reflected in auth/me');

    // 6. Study Partner Privacy Masking Verification
    console.log('\n[Test 6] Study Partner Privacy Masking (Default vs Shared)');
    const emailB = `learnerB_${Date.now()}@example.com`;
    const regB = await request('POST', '/api/auth/register', {
      name: 'Rahul Verma',
      email: emailB,
      password: 'Password123!'
    });
    const tokenB = regB.data.token;

    const grpRes = await request('POST', '/api/groups', {
      name: 'Analytics Duo',
      description: 'Cracking Data Analyst roles!'
    }, tokenA);
    const groupId = grpRes.data.groupId;
    const inviteCode = grpRes.data.inviteCode;

    const joinRes = await request('POST', '/api/groups/join', { inviteCode }, tokenB);
    assert(joinRes.status === 200, 'Learner B joined study group');

    const grpDetailBefore = await request('GET', `/api/groups/${groupId}`, null, tokenB);
    const partnerA_before = grpDetailBefore.data.members.find(m => m.name === 'Priya Sharma');
    assert(partnerA_before !== undefined, 'Learner A found in group members');
    assert(partnerA_before.phone === null, 'Partner phone masked to null by default');
    assert(partnerA_before.profile_photo === null, 'Partner photo masked to null by default');
    assert(partnerA_before.onboarding_role === null, 'Partner role masked to null by default');
    assert(partnerA_before.current_job_title === null, 'Partner job title masked to null by default');

    const updatePrivacy = await request('PUT', '/api/user/profile', {
      share_profile_photo: 1,
      share_current_role: 1,
      share_phone: 0,
      share_employer_info: 0
    }, tokenA);
    assert(updatePrivacy.status === 200, 'Learner A updated privacy toggles');

    const grpDetailAfter = await request('GET', `/api/groups/${groupId}`, null, tokenB);
    const partnerA_after = grpDetailAfter.data.members.find(m => m.name === 'Priya Sharma');
    assert(partnerA_after.profile_photo === photoUpload.data.profile_photo, 'Partner photo is now visible as opted-in');
    assert(partnerA_after.onboarding_role === 'Employed', 'Partner onboarding role is now visible as opted-in');
    assert(partnerA_after.phone === null, 'Partner phone remains strictly masked as opted-out');
    assert(partnerA_after.current_job_title === null, 'Partner employer info remains strictly masked');

    // 7. Career Paths Retrieval & Filtering
    console.log('\n[Test 7] Career Path Explorer Endpoints (16 Paths)');
    const allPathsRes = await request('GET', '/api/career-paths');
    assert(allPathsRes.status === 200, 'Career paths list returns 200');
    assert(allPathsRes.data.totalCount === 16, `Total career paths: ${allPathsRes.data.totalCount} (expected 16)`);

    const daPath = await request('GET', '/api/career-paths/data-analyst');
    assert(daPath.status === 200, 'Data Analyst path details retrieved');
    const da = daPath.data.careerPath;
    assert(da.title === 'Data Analyst', 'Role title is Data Analyst');
    assert(da.salaries_by_location && da.salaries_by_location.IN, 'Contains INR salaries');
    assert(da.salaries_by_location && da.salaries_by_location.US, 'Contains USD salaries');
    assert(da.salaries_by_location && da.salaries_by_location.UK, 'Contains GBP salaries');
    assert(da.salaries_by_location && da.salaries_by_location.CA, 'Contains CAD salaries');
    assert(da.salaries_by_location && (da.salaries_by_location.DE || da.salaries_by_location.EU), 'Contains EUR/DE salaries');
    assert(Array.isArray(da.day_to_day) && da.day_to_day.length > 0, 'Contains day-to-day duties');
    assert(Array.isArray(da.transferable_skills) && da.transferable_skills.length > 0, 'Contains transferable skills breakdown');
    assert(Array.isArray(da.essential_skills) && da.essential_skills.some(s => s.includes('SQL')), 'Essential skills includes SQL');
    assert(Array.isArray(da.portfolio_projects) && da.portfolio_projects.length > 0, 'Contains portfolio project blueprints');

    const nonTechPaths = await request('GET', '/api/career-paths?background=non-tech');
    assert(nonTechPaths.status === 200, 'Filtered non-tech paths returns 200');
    assert(nonTechPaths.data.totalCount >= 10, `Non-tech friendly count: ${nonTechPaths.data.totalCount}`);

    // 8. Career Explorer AI Tutor
    console.log('\n[Test 8] Career Explorer AI Tutor Advisor');
    const tutorRes = await request('POST', '/api/career-tutor/chat', {
      message: 'Can someone from my non-technical operations background transition into this role?',
      role_slug: 'data-analyst'
    }, tokenA);
    assert(tutorRes.status === 200, 'Career tutor returns 200 OK');
    assert(tutorRes.data.reply && tutorRes.data.reply.length > 50, 'Career tutor generated detailed guidance');
    assert(tutorRes.data.reply.toLowerCase().includes('transfer') || tutorRes.data.reply.toLowerCase().includes('analyst'), 'Guidance is contextually grounded');

    // 9. Transparent AI Usage & Safeguards
    console.log('\n[Test 9] Transparent AI Usage Endpoint');
    const aiUsage = await request('GET', '/api/ai/usage');
    assert(aiUsage.status === 200, 'AI usage endpoint returns 200');
    assert(aiUsage.data.flexibleUsage === true, 'Flexible usage enabled');
    assert(aiUsage.data.safeguards && aiUsage.data.safeguards.gracefulFallback, 'Safeguards documented');

    console.log('\n========================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');

    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
