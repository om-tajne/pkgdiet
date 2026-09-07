import fs from 'fs';
import path from 'path';
import prompts from 'prompts';

export async function runSetupWizard(options = {}) {
  console.log('\n🥗 Welcome to PkgDiet Setup!\n');

  const response = await prompts([
    {
      type: 'select',
      name: 'orgType',
      message: 'Are you configuring PkgDiet for an individual, team, or enterprise?',
      choices: [
        { title: 'Individual', value: 'individual', description: 'Simple defaults, no strict CI gates' },
        { title: 'Team / Enterprise', value: 'team', description: 'Stricter checks in CI, environment overrides' }
      ]
    },
    {
      type: 'multiselect',
      name: 'agents',
      message: 'Do you use any AI coding agents? (Space to select, Enter to confirm)',
      choices: [
        { title: 'Cursor', value: 'cursor' },
        { title: 'Windsurf', value: 'windsurf' },
        { title: 'VS Code + Copilot', value: 'copilot' }
      ],
      hint: '- Space to select. Return to submit'
    },
    {
      type: 'confirm',
      name: 'blockDeprecated',
      message: 'Do you want to explicitly BLOCK any packages marked as deprecated on npm?',
      initial: true
    }
  ], {
    onCancel: () => {
      console.log('\nSetup cancelled.');
      process.exit(0);
    }
  });

  // Generate Policy
  const policy = {
    minHealthScore: 40,
    warnHealthScore: 60,
    blockDeprecated: response.blockDeprecated,
    securityMode: 'fail-open',
    internalNamePrefixes: [],
    blockedPackages: [],
    telemetry: true,
    policyVersion: 1
  };

  if (response.orgType === 'team') {
    policy.environments = {
      ci: {
        minHealthScore: 50,
        failOn: 'BLOCK'
      },
      dev: {
        minHealthScore: 30,
        failOn: 'WARN'
      }
    };
  }

  const rcPath = path.join(process.cwd(), '.pkgdietrc.json');
  fs.writeFileSync(rcPath, JSON.stringify(policy, null, 2));
  
  console.log('\n✅ PkgDiet is configured for your workflow.');
  if (response.orgType === 'team') {
    console.log('   - CI policy: minHealthScore 50, failOn BLOCK');
  } else {
    console.log('   - Default policy: minHealthScore 40');
  }
  console.log(   - Deprecated packages: );

  // Setup Agents
  if (response.agents && response.agents.length > 0) {
    const { setupAgents } = await import('./agentSetup.js');
    await setupAgents(response.agents, process.cwd());
    console.log(   - AI agents:  enabled);
  } else {
    console.log('   - AI agents: None configured');
  }

  console.log('\nNext steps:');
  console.log('  - Run 
px pkgdiet check <package> to evaluate deps manually.');
  if (response.orgType === 'team') {
    console.log('  - Install the PkgDiet GitHub App at: https://github.com/apps/pkgdiet');
  }
  console.log('');
}
