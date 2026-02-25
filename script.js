const statusLines = [
  '> Engine boot: ModMind AI Generator online',
  '> Prompt parser: active',
  '> Generation mode: full project scaffold',
  '> Export mode: per-file + zip package',
  '> Ready to compile your idea into code'
];

const loaderOptions = {
  mods: ['fabric', 'forge', 'quilt', 'neoforge'],
  plugins: ['bukkit', 'spigot']
};

const form = document.getElementById('generatorForm');
const promptInput = document.getElementById('promptInput');
const parsePromptBtn = document.getElementById('parsePromptBtn');
const projectNameInput = document.getElementById('projectName');
const packageNameInput = document.getElementById('packageName');
const featureThemeInput = document.getElementById('featureTheme');
const aiType = document.getElementById('aiType');
const loader = document.getElementById('loader');
const statusLog = document.getElementById('statusLog');
const summary = document.getElementById('summary');
const fileList = document.getElementById('fileList');
const codeView = document.getElementById('codeView');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const year = document.getElementById('year');

year.textContent = new Date().getFullYear();

let latestFiles = [];
let latestProjectName = 'modmind-project';

function setLoaderOptions() {
  const nextOptions = loaderOptions[aiType.value] || [];
  loader.innerHTML = nextOptions
    .map(item => `<option value="${item}">${item[0].toUpperCase()}${item.slice(1)}</option>`)
    .join('');
}

function packageToPath(packageName) {
  return packageName.replace(/\./g, '/');
}

function selectedFeatures() {
  return Array.from(document.querySelectorAll('input[name="feature"]:checked')).map(item => item.value);
}

function toggleFeatures(nextFeatures) {
  document.querySelectorAll('input[name="feature"]').forEach(item => {
    item.checked = nextFeatures.includes(item.value);
  });
}

function sanitizeProjectName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '') || 'MyProject';
}

function inferNameFromPrompt(prompt) {
  const namedMatch = prompt.match(/(?:called|named)\s+([A-Za-z][\w-]*)/i);
  if (namedMatch) return sanitizeProjectName(namedMatch[1]);
  const titleWord = prompt.split(/\s+/).find(word => /^[A-Z][a-zA-Z0-9_-]{3,}$/.test(word));
  return sanitizeProjectName(titleWord || 'MyProject');
}

function inferThemeFromPrompt(prompt) {
  const lowered = prompt.toLowerCase();
  const tags = [];
  const rules = [
    ['magic', 'spell casting'],
    ['rpg', 'rpg progression'],
    ['boss', 'boss encounters'],
    ['dungeon', 'dungeon rewards'],
    ['economy', 'economy systems'],
    ['pvp', 'pvp balancing'],
    ['quest', 'quest tracking'],
    ['tool', 'custom tool tiers'],
    ['mob', 'mob behavior']
  ];

  rules.forEach(([needle, label]) => {
    if (lowered.includes(needle)) tags.push(label);
  });

  if (!tags.length) return 'core gameplay features and progression';
  return tags.join(', ');
}

function inferFromPrompt(prompt) {
  const lowered = prompt.toLowerCase();

  const inferredAI = lowered.match(/plugin|spigot|bukkit|server/) ? 'plugins' : 'mods';

  let inferredLoader = inferredAI === 'plugins' ? 'spigot' : 'fabric';
  ['fabric', 'forge', 'quilt', 'neoforge', 'bukkit', 'spigot'].forEach(candidate => {
    if (lowered.includes(candidate)) inferredLoader = candidate;
  });

  if (inferredAI === 'plugins' && !['bukkit', 'spigot'].includes(inferredLoader)) {
    inferredLoader = 'spigot';
  }
  if (inferredAI === 'mods' && ['bukkit', 'spigot'].includes(inferredLoader)) {
    inferredLoader = 'fabric';
  }

  const inferredFeatures = [];
  if (/command|slash command/.test(lowered)) inferredFeatures.push('commands');
  if (/event|listener|join|death/.test(lowered)) inferredFeatures.push('events');
  if (/config|setting|yaml|toml|json/.test(lowered)) inferredFeatures.push('config');
  if (!inferredFeatures.length) inferredFeatures.push('commands', 'events', 'config');

  const inferredProjectName = inferNameFromPrompt(prompt);
  const inferredPackage = `dev.modmind.${inferredProjectName.toLowerCase()}`;
  const inferredTheme = inferThemeFromPrompt(prompt);

  return {
    aiSystem: inferredAI,
    loaderName: inferredLoader,
    features: inferredFeatures,
    projectName: inferredProjectName,
    packageName: inferredPackage,
    theme: inferredTheme
  };
}

function applyPromptToSettings() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    summary.classList.remove('muted');
    summary.textContent = 'Enter a prompt first so ModMind AI can infer settings.';
    return;
  }

  const inferred = inferFromPrompt(prompt);
  aiType.value = inferred.aiSystem;
  setLoaderOptions();
  loader.value = inferred.loaderName;
  projectNameInput.value = inferred.projectName;
  packageNameInput.value = inferred.packageName;
  featureThemeInput.value = inferred.theme;
  toggleFeatures(inferred.features);

  summary.classList.add('muted');
  summary.textContent = `Prompt parsed: ${inferred.aiSystem} • ${inferred.loaderName} • ${inferred.features.join(', ')}`;
}

function createJavaMainClass(projectName, packageName, aiSystem, loaderName, features, theme) {
  const className = `${sanitizeProjectName(projectName).replace(/[^a-zA-Z0-9]/g, '')}Main`;
  const featureMethods = [];

  if (features.includes('commands')) featureMethods.push('    bootstrapCommandSystem();');
  if (features.includes('events')) featureMethods.push('    bootstrapEventSystem();');
  if (features.includes('config')) featureMethods.push(aiSystem === 'plugins' ? '    saveDefaultConfig();' : '    bootstrapConfig();');

  if (aiSystem === 'plugins') {
    return `package ${packageName};

import ${packageName}.commands.MainCommand;
import ${packageName}.events.PlayerJoinListener;
import ${packageName}.service.FeatureService;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

public final class ${className} extends JavaPlugin {
  private FeatureService featureService;

  @Override
  public void onEnable() {
    this.featureService = new FeatureService("${theme}");
${featureMethods.join('\n')}
    getLogger().info("${projectName} enabled on ${loaderName}.");
  }

  private void bootstrapCommandSystem() {
    PluginCommand command = getCommand("${projectName.toLowerCase()}");
    if (command != null) command.setExecutor(new MainCommand(featureService));
  }

  private void bootstrapEventSystem() {
    getServer().getPluginManager().registerEvents(new PlayerJoinListener(featureService), this);
  }

  private void bootstrapConfig() {
    saveDefaultConfig();
  }
}
`;
  }

  return `package ${packageName};

import ${packageName}.service.FeatureService;
import ${packageName}.registry.ModRegistry;

public class ${className} {
  private final FeatureService featureService = new FeatureService("${theme}");

  public void onInitialize() {
    ModRegistry.registerAll();
${featureMethods.join('\n')}
    System.out.println("${projectName} initialized on ${loaderName}.");
  }

  private void bootstrapCommandSystem() {
    System.out.println("Command template initialized: " + featureService.getThemeDescription());
  }

  private void bootstrapEventSystem() {
    System.out.println("Event wiring template initialized.");
  }

  private void bootstrapConfig() {
    System.out.println("Config bootstrap initialized.");
  }
}
`;
}

function createMetaFile(projectName, packageName, aiSystem, loaderName) {
  const safeId = sanitizeProjectName(projectName).toLowerCase();
  const className = `${sanitizeProjectName(projectName).replace(/[^a-zA-Z0-9]/g, '')}Main`;

  if (aiSystem === 'plugins') {
    return {
      path: 'src/main/resources/plugin.yml',
      content: `name: ${projectName}
main: ${packageName}.${className}
version: 1.0.0
api-version: '1.20'
commands:
  ${safeId}:
    description: Main command generated for ${projectName}
`
    };
  }

  if (loaderName === 'fabric' || loaderName === 'quilt') {
    return {
      path: `src/main/resources/${loaderName === 'fabric' ? 'fabric.mod.json' : 'quilt.mod.json'}`,
      content: `{
  "schemaVersion": 1,
  "id": "${safeId}",
  "version": "1.0.0",
  "name": "${projectName}",
  "entrypoints": { "main": ["${packageName}.${className}"] }
}`
    };
  }

  return {
    path: 'src/main/resources/META-INF/mods.toml',
    content: `modLoader="javafml"
loaderVersion="[47,)"
[[mods]]
modId="${safeId}"
version="1.0.0"
displayName="${projectName}"
`
  };
}

function createGradleFiles(projectName, packageName, loaderName) {
  return [
    { path: 'settings.gradle', content: `rootProject.name = '${sanitizeProjectName(projectName)}'\n` },
    {
      path: 'gradle.properties',
      content: `org.gradle.jvmargs=-Xmx2G\nproject_group=${packageName}\nloader_target=${loaderName}\n`
    },
    {
      path: 'build.gradle',
      content: `plugins { id 'java' }\ngroup='${packageName}'\nversion='1.0.0'\nrepositories { mavenCentral() }\n`
    }
  ];
}

function createServiceFiles(packageName, theme) {
  return [
    {
      path: `src/main/java/${packageToPath(packageName)}/service/FeatureService.java`,
      content: `package ${packageName}.service;\n\npublic class FeatureService {\n  private final String theme;\n  public FeatureService(String theme) { this.theme = theme; }\n  public String getThemeDescription() { return "Theme: " + theme; }\n}\n`
    },
    {
      path: `src/main/java/${packageToPath(packageName)}/registry/ModRegistry.java`,
      content: `package ${packageName}.registry;\n\npublic final class ModRegistry {\n  private ModRegistry() {}\n  public static void registerAll() { System.out.println("Registering generated systems."); }\n}\n`
    }
  ];
}

function createFeatureFiles(projectName, packageName, aiSystem, features) {
  const files = [];

  if (features.includes('commands')) {
    files.push({
      path: `src/main/java/${packageToPath(packageName)}/commands/MainCommand.java`,
      content:
        aiSystem === 'plugins'
          ? `package ${packageName}.commands;\n\nimport ${packageName}.service.FeatureService;\nimport org.bukkit.command.*;\n\npublic class MainCommand implements CommandExecutor {\n  private final FeatureService service;\n  public MainCommand(FeatureService service) { this.service = service; }\n  @Override\n  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {\n    sender.sendMessage(service.getThemeDescription());\n    return true;\n  }\n}\n`
          : `package ${packageName}.commands;\n\npublic class MainCommand {\n  public void register() { System.out.println("Mod command registered."); }\n}\n`
    });
  }

  if (features.includes('events')) {
    files.push({
      path: `src/main/java/${packageToPath(packageName)}/events/PlayerJoinListener.java`,
      content:
        aiSystem === 'plugins'
          ? `package ${packageName}.events;\n\nimport org.bukkit.event.*;\nimport org.bukkit.event.player.PlayerJoinEvent;\n\npublic class PlayerJoinListener implements Listener {\n  @EventHandler\n  public void onJoin(PlayerJoinEvent event) { event.getPlayer().sendMessage("Welcome to generated content!"); }\n}\n`
          : `package ${packageName}.events;\n\npublic class PlayerJoinListener {\n  public void register() { System.out.println("Event hooks registered."); }\n}\n`
    });
  }

  if (features.includes('config')) {
    files.push({
      path: 'src/main/resources/modmind-config.yml',
      content: `project:\n  generated: true\n  debug: false\n`
    });
  }

  return files;
}

function createReadme(projectName, aiSystem, loaderName, theme, features, prompt) {
  return {
    path: 'README.md',
    content: `# ${projectName}\n\nGenerated by ModMind AI (${aiSystem} on ${loaderName}).\n\n## Prompt\n${prompt || 'Manual settings used'}\n\n## Theme\n${theme}\n\n## Features\n${features.map(item => `- ${item}`).join('\n')}\n`
  };
}

function buildFiles({ projectName, packageName, aiSystem, loaderName, features, theme, prompt }) {
  const className = `${sanitizeProjectName(projectName).replace(/[^a-zA-Z0-9]/g, '')}Main`;

  return [
    createReadme(projectName, aiSystem, loaderName, theme, features, prompt),
    ...createGradleFiles(projectName, packageName, loaderName),
    {
      path: `src/main/java/${packageToPath(packageName)}/${className}.java`,
      content: createJavaMainClass(projectName, packageName, aiSystem, loaderName, features, theme)
    },
    createMetaFile(projectName, packageName, aiSystem, loaderName),
    ...createServiceFiles(packageName, theme),
    ...createFeatureFiles(projectName, packageName, aiSystem, features)
  ];
}

function downloadSingleFile(file) {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.path.split('/').pop() || 'generated-file.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderFiles(files) {
  latestFiles = files;
  fileList.innerHTML = '';

  files.forEach((file, index) => {
    const row = document.createElement('li');
    row.className = 'file-row';

    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'file-preview';
    previewButton.textContent = file.path;
    previewButton.addEventListener('click', () => {
      document.querySelectorAll('.file-preview').forEach(btn => btn.classList.remove('active'));
      previewButton.classList.add('active');
      codeView.textContent = file.content;
    });

    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'file-download';
    downloadButton.textContent = '↓';
    downloadButton.addEventListener('click', () => downloadSingleFile(file));

    if (index === 0) {
      previewButton.classList.add('active');
      codeView.textContent = file.content;
    }

    row.appendChild(previewButton);
    row.appendChild(downloadButton);
    fileList.appendChild(row);
  });

  downloadZipBtn.disabled = files.length === 0;
}

async function downloadZipBundle() {
  if (!latestFiles.length) return;
  if (!window.JSZip) {
    summary.classList.remove('muted');
    summary.textContent = 'Zip library failed to load. Reload page with internet access.';
    return;
  }

  const zip = new window.JSZip();
  latestFiles.forEach(file => zip.file(file.path, file.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${latestProjectName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validatePackageName(packageName) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName);
}

function runGeneration(event) {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  const projectName = projectNameInput.value.trim();
  const packageName = packageNameInput.value.trim();
  const theme = featureThemeInput.value.trim();
  const aiSystem = aiType.value;
  const loaderName = loader.value;
  const features = selectedFeatures();

  if (!projectName) {
    summary.classList.remove('muted');
    summary.textContent = 'Please enter a project name.';
    return;
  }

  if (!validatePackageName(packageName)) {
    summary.classList.remove('muted');
    summary.textContent = 'Package name must look like: dev.modmind.project';
    return;
  }

  if (!theme || !features.length) {
    summary.classList.remove('muted');
    summary.textContent = 'Provide theme and select at least one feature.';
    return;
  }

  latestProjectName = sanitizeProjectName(projectName).toLowerCase();
  const files = buildFiles({ projectName, packageName, aiSystem, loaderName, features, theme, prompt });
  renderFiles(files);
  summary.classList.add('muted');
  summary.textContent = `Generated ${files.length} files from ${prompt ? 'prompt + settings' : 'manual settings'} (${aiSystem} • ${loaderName}).`;
}

function animateStatus() {
  let line = 0;
  function tick() {
    if (line === 0) statusLog.textContent = '';
    statusLog.textContent += `${statusLines[line]}\n`;
    line += 1;
    if (line >= statusLines.length) line = 0;
    setTimeout(tick, 1400);
  }
  tick();
}

function initRevealAnimations() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('show');
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

parsePromptBtn.addEventListener('click', applyPromptToSettings);
aiType.addEventListener('change', setLoaderOptions);
form.addEventListener('submit', runGeneration);
downloadZipBtn.addEventListener('click', downloadZipBundle);

setLoaderOptions();
animateStatus();
initRevealAnimations();
