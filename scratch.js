const fs = require('fs');

let content = fs.readFileSync('components/AIEngineConfigPanel.tsx', 'utf8');

// 1. Remove ollama and lmstudio from PROVIDERS
content = content.replace(/  ollama: \{[\s\S]*?docsUrl: 'https:\/\/ollama\.com\/library',\n  \},\n  lmstudio: \{[\s\S]*?docsUrl: 'https:\/\/lmstudio\.ai',\n  \},/m, '');

// 2. Remove LocalModel and LocalSource interfaces
content = content.replace(/\/\/ ─── Local Model type ─────────────────────────────────────────────────────────[\s\S]*?\/\/ ─── Sub-components ───────────────────────────────────────────────────────────/, '// ─── Sub-components ───────────────────────────────────────────────────────────');

// 3. Remove PanelMode and mode state
content = content.replace(/type PanelMode = 'cloud' \| 'local';\n/, '');
content = content.replace(/  const \[mode, setMode\].*?;\n/g, '');

// 4. Remove local mode state variables
content = content.replace(/  \/\/ Local mode state\n[\s\S]*?\/\/ Shared/, '  // Shared');

// 5. Remove isLocal / local variables
content = content.replace(/  const isLocal  = mode === 'local';\n  const anyLocalRunning = localSources\.some\(s => s\.running\);\n/, '');

// 6. Update restore from localStorage
const storedLogic = `    const stored = loadAIEngineConfig();
    if (stored) {
      if (stored.isLocal) {
        setMode('local');
        fetchLocalModels();
      } else {
        setMode('cloud');
        if (stored.provider && PROVIDERS[stored.provider]) {
          setSelectedProviderId(stored.provider);
        }
        setCustomModelText(stored.model ?? '');
        setUseCustomModel(true);
        setTemperature(stored.temperature ?? 0.6);
        setCustomBaseUrl(stored.baseUrl ?? '');
      }
      setFullAppMode(stored.fullAppMode ?? false);
      setMultiSlide(stored.multiSlideMode ?? false);
    }`;

const newStoredLogic = `    const stored = loadAIEngineConfig();
    if (stored) {
      if (stored.provider && PROVIDERS[stored.provider]) {
        setSelectedProviderId(stored.provider);
      }
      setCustomModelText(stored.model ?? '');
      setUseCustomModel(true);
      setTemperature(stored.temperature ?? 0.6);
      setCustomBaseUrl(stored.baseUrl ?? '');
      setFullAppMode(stored.fullAppMode ?? false);
      setMultiSlide(stored.multiSlideMode ?? false);
    }`;

content = content.replace(storedLogic, newStoredLogic);

// 7. Remove fetchLocalModels and handleModeSwitch functions
content = content.replace(/  \/\/ ── Fetch local models ─────────────────────────────────────────────────[\s\S]*?\const fetchModels =/m, '  const fetchModels =');

// 8. Update handleSave logic
const saveLogic = `    if (mode === 'cloud') {
      if (!selectedProviderId || !PROVIDERS[selectedProviderId]) {
        setError('Choose a provider first.');
        setCloudStep(1);
        return;
      }
      if (!apiKey.trim() && !provider.noKey) {
        setError('Enter API credentials before choosing a model.');
        setCloudStep(2);
        return;
      }
      if (!effectiveModel) {
        setError('Choose a generation model or enter a custom one.');
        setCloudStep(3);
        return;
      }
    } else {
      if (!selectedLocalSource) { setError('No local runtime selected.'); return; }
      if (!selectedLocalModel) { setError('Select a model from the list.'); return; }
      if (!selectedLocalSource.running) {
        setError(\`\${selectedLocalSource.name} is not running. Start it and refresh.\`);
        return;
      }
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    let config: AIEngineConfig;

    if (mode === 'cloud') {
      config = {
        provider: provider.id,
        providerName: provider.name,
        model: effectiveModel,
        apiKey: apiKey.trim(),
        baseUrl: customBaseUrl.trim() || provider.baseUrl,
        temperature,
        fullAppMode,
        multiSlideMode,
        isLocal: false,
      };
    } else {
      config = {
        provider: selectedLocalSource!.provider,
        providerName: selectedLocalSource!.name,
        model: selectedLocalModel!.id,
        apiKey: 'local',
        baseUrl: selectedLocalSource!.v1BaseUrl,
        temperature: selectedLocalModel!.temperature,
        fullAppMode,
        multiSlideMode,
        isLocal: true,
      };
    }`;

const newSaveLogic = `    if (!selectedProviderId || !PROVIDERS[selectedProviderId]) {
      setError('Choose a provider first.');
      setCloudStep(1);
      return;
    }
    if (!apiKey.trim() && !provider.noKey) {
      setError('Enter API credentials before choosing a model.');
      setCloudStep(2);
      return;
    }
    if (!effectiveModel) {
      setError('Choose a generation model or enter a custom one.');
      setCloudStep(3);
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    const config: AIEngineConfig = {
      provider: provider.id,
      providerName: provider.name,
      model: effectiveModel,
      apiKey: apiKey.trim(),
      baseUrl: customBaseUrl.trim() || provider.baseUrl,
      temperature,
      fullAppMode,
      multiSlideMode,
      isLocal: false,
    };`;

content = content.replace(saveLogic, newSaveLogic);

// 9. Remove local handleDeactivate states
content = content.replace(/    setSelectedLocalSource\(null\);\n    setSelectedLocalModel\(null\);\n/, '');

// 10. Update headerGradient
content = content.replace(/  const headerGradient = isLocal \? 'from-lime-500 to-green-600' : provider.color;\n/, '  const headerGradient = provider.color;\n');

// 11. Remove Mode tabs
content = content.replace(/        \{\/\* Mode tabs — Cloud vs Local \*\/\}[\s\S]*?        \{\/\* Scrollable body \*\/\}[\s\S]*?        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">/, '        {/* Scrollable body */}\n        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">');

// 12. Remove Cloud wrapper and Local Mode block
content = content.replace(/          \{\/\* ══ CLOUD MODE ════════════════════════════════════════════════════ \*\/\}[\s\S]*?          \{mode === 'cloud' && \(\n            <>/, '          {/* ══ ENGINE CONFIGURATION ════════════════════════════════════════════════════ */}');

// The closing wrapper of cloud mode
content = content.replace(/            <\/>\n          \)}\n\n          \{\/\* ══ LOCAL MODE ════════════════════════════════════════════════════ \*\/\}[\s\S]*?          \{error && \(/, '          {error && (');

// 13. Remove specific 'mode' dependencies in the save buttons at the bottom.
content = content.replace(/if \(mode === 'cloud' && cloudStep === 1\)/g, 'if (cloudStep === 1)');
content = content.replace(/else if \(mode === 'cloud' && cloudStep === 2\)/g, 'else if (cloudStep === 2)');

content = content.replace(/sessionActive && !saving && \(mode !== 'cloud' \|\| cloudStep === 3\)/g, 'sessionActive && !saving && cloudStep === 3');
content = content.replace(/: isLocal\n\s+\? 'bg-gradient-to-r from-lime-500 to-green-600 text-white hover:opacity-90'\n\s+: `bg-gradient-to-r \$\{provider.color\} text-white hover:opacity-90`/, ': `bg-gradient-to-r ${provider.color} text-white hover:opacity-90`');

content = content.replace(/!saving && !saved && sessionActive && \(mode !== 'cloud' \|\| cloudStep === 3\)/g, '!saving && !saved && sessionActive && cloudStep === 3');

content = content.replace(/mode === 'cloud' && cloudStep === 1/g, 'cloudStep === 1');
content = content.replace(/mode === 'cloud' && cloudStep === 2/g, 'cloudStep === 2');

fs.writeFileSync('components/AIEngineConfigPanel.tsx', content);
