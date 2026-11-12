const commands = [
  '/agent',
  '/agents',
  '/exit',
  '/help',
  '/history',
  '/input',
  '/model',
  '/mode',
  '/models',
  '/new',
  '/skill',
  '/team',
];
const skillCommands = ['help', 'install ', 'list', 'remove '].map((sub) => `/skill ${sub}`);

export function completeCommand(input: string, agentIds: readonly string[]): [string[], string] {
  const agentCommand = ['/agent ', '/models '].find((prefix) => input.startsWith(prefix));
  const candidates = agentCommand
    ? ['auto', ...agentIds].map((id) => `${agentCommand}${id}`)
    : input.startsWith('/mode ')
      ? ['/mode agent', '/mode subagent']
      : input.startsWith('/input ')
        ? ['/input telex', '/input vni', '/input system']
        : input.startsWith('/skill ')
          ? skillCommands
          : input.startsWith('/')
            ? commands
            : [];
  return [candidates.filter((candidate) => candidate.startsWith(input)), input];
}
