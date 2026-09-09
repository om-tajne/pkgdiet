import fs from 'fs';
import path from 'path';
export async function runSetupWizard() {
    const prompts = (await import('prompts')).default;
    console.log('\n🥗 Welcome to PkgDiet Setup Wizard\n');
    const questions = [
        {
            type: 'select',
            name: 'orgType',
            message: 'How will you use PkgDiet?',
            choices: [
                { title: 'Individual Developer (CLI + Agent Guardrails)', value: 'individual' },
                { title: 'Team / Enterprise (PR Gates + Central Policy)', value: 'team' }
            ]
        },
        {
            type: 'multiselect',
            name: 'agents',
            message: 'Which AI agents do you use? (We will auto-configure MCP)',
            choices: [
                { title: 'Cursor', value: 'cursor' },
                { title: 'Windsurf', value: 'windsurf' },
                { title: 'Cline', value: 'cline' },
                { title: 'GitHub Copilot', value: 'copilot' },
                { title: 'Claude Desktop', value: 'claude-code' }
            ]
        },
        {
            type: 'select',
            name: 'strictness',
            message: 'How strict should PkgDiet be about blocking bad packages?',
            choices: [
                { title: 'Strict (Block <60 health, block all deprecated)', value: 'strict' },
                { title: 'Balanced (Block <40 health, warn on deprecated)', value: 'balanced' },
                { title: 'Lenient (Warn only, never block)', value: 'lenient' }
            ]
        }
    ];
    const response = await prompts(questions);
    if (!response.orgType) {
        console.log('Setup aborted.');
        return;
    }
    const policy = {
        policyVersion: 1,
        minHealthScore: 40,
        warnHealthScore: 60,
        blockDeprecated: true,
        securityMode: 'fail-closed',
        internalNamePrefixes: [],
        environments: {},
        blockedPackages: [],
        telemetry: true
    };
    if (response.strictness === 'strict') {
        policy.minHealthScore = 60;
        policy.warnHealthScore = 80;
    }
    else if (response.strictness === 'lenient') {
        policy.minHealthScore = 0;
        policy.warnHealthScore = 40;
        policy.blockDeprecated = false;
    }
    if (response.orgType === 'team') {
        policy.environments.ci = {
            minHealthScore: policy.minHealthScore + 10,
            failOn: response.strictness === 'lenient' ? 'WARN' : 'BLOCK'
        };
    }
    const rcPath = path.join(process.cwd(), '.pkgdietrc.json');
    fs.writeFileSync(rcPath, JSON.stringify(policy, null, 2));
    console.log('\n✅ PkgDiet is configured for your workflow.');
    if (response.orgType === 'team') {
        console.log(`   - CI policy: minHealthScore ${policy.environments.ci.minHealthScore}, failOn ${policy.environments.ci.failOn}`);
    }
    else {
        console.log(`   - Default policy: minHealthScore ${policy.minHealthScore}`);
    }
    console.log(`   - Deprecated packages: ${policy.blockDeprecated ? 'Blocked' : 'Allowed'}`);
    if (response.agents && response.agents.length > 0) {
        const { setupAgents } = await import('./agentSetup.js');
        await setupAgents(response.agents, process.cwd());
        console.log(`   - AI agents: ${response.agents.join(', ')} enabled`);
    }
    else {
        console.log('   - AI agents: None configured');
    }
    console.log('\nNext steps:');
    console.log('  - Run `npx pkgdiet check <package>` to evaluate deps manually.');
    if (response.orgType === 'team') {
        console.log('  - Install the PkgDiet GitHub App at: https://github.com/apps/pkgdiet');
    }
    console.log('');
}
