const ProjectBrain = require('./index');
require('dotenv').config();

async function runTest() {
  console.log('--- ProjectBrain v2 Test Suite ---');

  const brain = new ProjectBrain({
    apiKey: process.env.NOVYX_API_KEY
  });

  const sessionId = `test-brain-${Date.now()}`;

  // 1. Save a technical decision
  console.log('\n[1] Saving technical decision...');
  const nonce = Date.now();
  const decision = `ProjectBrain test ${nonce}: We decided to use Postgres for the database and Supabase for auth.`;
  const saved = await brain.remember(decision, ['test', 'project-context', `session:${sessionId}`]);
  if (saved) {
    console.log(`    Saved: ${saved.uuid || saved.id}`);
  } else {
    console.log('    FAILED to save.');
    return;
  }

  // Wait for indexing
  await new Promise(r => setTimeout(r, 1500));

  // 2. Test /brain recall
  console.log('\n[2] Testing /brain recall...');
  const recallResult = await brain.handleRecall(`/brain recall database ${nonce}`, sessionId);
  console.log(`    ${recallResult.split('\n').join('\n    ')}`);
  if (recallResult.includes('Postgres') || recallResult.includes(String(nonce))) {
    console.log('    SUCCESS: Recall found the decision.');
  } else {
    console.log('    FAILED: Recall did not find the decision.');
  }

  // 3. Test /brain stats
  console.log('\n[3] Testing /brain stats...');
  const statsResult = await brain.handleStats('/brain stats', sessionId);
  console.log(`    ${statsResult.split('\n').join('\n    ')}`);
  if (statsResult.includes('Tier:') && statsResult.includes('Memories:')) {
    console.log('    SUCCESS: Stats returned usage info.');
  } else {
    console.log('    FAILED: Stats did not return expected fields.');
  }

  // 4. Test /brain status
  console.log('\n[4] Testing /brain status...');
  const statusResult = await brain.handleStatus('/brain status', sessionId);
  console.log(`    ${statusResult.split('\n').join('\n    ')}`);
  if (statusResult.includes('Context') || statusResult.includes('empty')) {
    console.log('    SUCCESS: Status returned context.');
  } else {
    console.log('    FAILED: Unexpected status response.');
  }

  // 5. Test semantic novelty detection
  console.log('\n[5] Testing novelty detection...');
  const isNovel1 = await brain._isNovel(`Something completely new about GraphQL at ${nonce}`);
  const isNovel2 = await brain._isNovel(decision); // Same as saved — should NOT be novel
  console.log(`    New topic novel? ${isNovel1}`);
  console.log(`    Duplicate novel? ${isNovel2}`);
  if (isNovel1 === true && isNovel2 === false) {
    console.log('    SUCCESS: Novelty detection working correctly.');
  } else {
    console.log('    INFO: Novelty results may vary based on existing memory state.');
  }

  // 6. Test /brain rewind (Pro feature — expect graceful 403 on free tier)
  console.log('\n[6] Testing /brain rewind (Pro feature)...');
  const rewindResult = await brain.handleRewind('/brain rewind 1 hour ago', sessionId);
  console.log(`    ${rewindResult.split('\n').join('\n    ')}`);
  if (rewindResult.includes('Preview') || rewindResult.includes('Pro plan')) {
    console.log('    SUCCESS: Rewind returned preview or tier gate.');
  } else {
    console.log('    INFO: Unexpected rewind response.');
  }

  // 7. Test /brain diff (Pro feature — expect graceful 403 on free tier)
  console.log('\n[7] Testing /brain diff (Pro feature)...');
  const diffResult = await brain.handleDiff('/brain diff 1h', sessionId);
  console.log(`    ${diffResult.split('\n').join('\n    ')}`);
  if (diffResult.includes('Diff') || diffResult.includes('Pro plan')) {
    console.log('    SUCCESS: Diff returned results or tier gate.');
  } else {
    console.log('    INFO: Unexpected diff response.');
  }

  // 8. Test /brain help
  console.log('\n[8] Testing /brain help...');
  const helpResult = await brain.handleHelp();
  console.log(`    ${helpResult.split('\n').join('\n    ')}`);
  if (helpResult.includes('/brain rewind') && helpResult.includes('/brain prove')) {
    console.log('    SUCCESS: Help lists all v2 commands.');
  } else {
    console.log('    FAILED: Help missing v2 commands.');
  }

  console.log('\n--- All tests complete ---');
}

if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = ProjectBrain;
