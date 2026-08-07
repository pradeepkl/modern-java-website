/**
 * EventBridge entrypoint for the daily sample nurture job.
 */
const { runSampleNurtureJob } = require('./sampleNurtureJob');

async function handler(event = {}, context = {}) {
  console.log('sampleNurtureHandler start', {
    requestId: context.awsRequestId,
    source: event.source || event['detail-type'] || 'unknown',
  });

  const summary = await runSampleNurtureJob({
    dryRun: false,
  });

  console.log('sampleNurtureHandler complete', summary);
  return {
    ok: true,
    ...summary,
  };
}

module.exports = { handler };
