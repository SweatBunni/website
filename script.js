const statusLines = [
  '> Engine boot: ModMind AI online',
  '> Backend mode: custom Java model endpoint',
  '> Input: prompt + project metadata',
  '> Output: generated file objects',
  '> Export: per-file + zip ready'
];

const form = document.getElementById('generatorForm');
const aiType = document.getElementById('aiType');
const loader = document.getElementById('loader');
const statusLog = document.getElementById('statusLog');
const summary = document.getElementById('summary');
const fileList = document.getElementById('fileList');
const codeView = document.getElementById('codeView');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const generateBtn = document.getElementById('generateBtn');
const year = document.getElementById('year');

year.textContent = new Date().getFullYear();

let latestFiles = [];
let latestProjectName = 'modmind-project';

function sanitizeProjectName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '') || 'myproject';
}

function validatePackageName(packageName) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName);
}

function getProjectPayload() {
  const projectName = document.getElementById('projectName').value.trim();
  const packageName = document.getElementById('packageName').value.trim();
  const projectType = aiType.value;
  const targetLoader = loader.value;
  const modelEndpoint = document.getElementById('modelEndpoint').value.trim();
  const modelName = document.getElementById('modelName').value.trim();
  const prompt = document.getElementById('promptInput').value.trim();

  if (!projectName) throw new Error('Project name is required.');
  if (!validatePackageName(packageName)) throw new Error('Java package must look like: dev.modmind.project');
  if (!modelEndpoint) throw new Error('Model endpoint is required.');
  if (!modelName) throw new Error('Model name is required.');
  if (!prompt) throw new Error('Prompt is required.');

  return {
    projectName,
    packageName,
    projectType,
    targetLoader,
    model: modelName,
    prompt
  };
}

async function callModelEndpoint(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Model API request failed (${response.status}).`);
  }

  const raw = await response.text();
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Model response is not valid JSON.');
  }

  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error('Model response must include a files array.');
  }

  const normalizedFiles = parsed.files
    .filter(item => item && typeof item.path === 'string' && typeof item.content === 'string')
    .map(item => ({ path: item.path, content: item.content }));

  if (!normalizedFiles.length) {
    throw new Error('Model returned no valid files.');
  }

  return { files: normalizedFiles, usage: parsed.usage || null };
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
    downloadButton.title = `Download ${file.path}`;
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

async function runGeneration(event) {
  event.preventDefault();

  try {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    const payload = getProjectPayload();
    const endpoint = document.getElementById('modelEndpoint').value.trim();
    latestProjectName = sanitizeProjectName(payload.projectName).toLowerCase();

    summary.classList.add('muted');
    summary.textContent = `Calling ${payload.model}...`;

    const result = await callModelEndpoint(endpoint, payload);
    renderFiles(result.files);

    const usageText = result.usage ? ` | tokens: ${JSON.stringify(result.usage)}` : '';
    summary.textContent = `Generated ${result.files.length} files with model "${payload.model}".${usageText}`;
  } catch (error) {
    summary.classList.remove('muted');
    summary.textContent = error.message;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate with Model';
  }
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

form.addEventListener('submit', runGeneration);
downloadZipBtn.addEventListener('click', downloadZipBundle);
animateStatus();
initRevealAnimations();
