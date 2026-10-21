import { ASK_TOOL, DATA_TOOL, dataCalls, outputFileIds, readOutcome, requestTools, safeFileName, systemPrompt, textFileName, userMessage } from '@/lib/features/office/work';

const base = { category: 'document' as const, title: 'Garanti belgesi', brief: 'Logo üstte', agentId: 'elif', answers: [], notes: [], revision: 0, companyName: 'Renk Alüminyum' };

describe('AI office work requests', () => {
  it('gives Office file work the matching Anthropic skill and the sandbox', () => {
    expect(requestTools('spreadsheet').container).toEqual({ skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }] });
    expect(requestTools('presentation').container?.skills[0].skill_id).toBe('pptx');
    const doc = requestTools('document');
    expect(doc.tools.map(t => t.name)).toEqual([ASK_TOOL.name, DATA_TOOL.name, 'code_execution']);
    expect(doc.betas).toEqual(['code-execution-2025-08-25']);
  });

  it('lets research search the web a few times and keeps plain writing out of the sandbox', () => {
    expect(requestTools('research').tools).toContainEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 });
    const letter = requestTools('correspondence');
    expect(letter.tools.map(t => t.name)).toEqual([ASK_TOOL.name, DATA_TOOL.name]);
    expect(letter.container).toBeUndefined();
    expect(letter.betas).toEqual([]);
    expect(requestTools('design').container).toBeUndefined();
  });

  it('writes the firm, the person and the earlier answers and revision notes into the request', () => {
    expect(systemPrompt(base)).toContain('Renk Alüminyum firmasının');
    expect(systemPrompt(base)).toContain('Elif');
    const message = userMessage({ ...base, answers: [{ question: 'Hangi ölçü?', answer: 'A4' }], notes: ['Daha kısa olsun'], revision: 1 });
    expect(message).toContain('Görev: Garanti belgesi');
    expect(message).toContain('Cevap: A4');
    expect(message).toContain('1. revizyon');
    expect(message).toContain('- Daha kısa olsun');
  });

  it('gives the firm\'s own details and sends the person to the records before asking', () => {
    const prompt = systemPrompt({ ...base, company: { legal_name: 'Renk Alüminyum San. Ltd. Şti.', city: 'Ankara' } });
    expect(prompt).toContain('Renk Alüminyum San. Ltd. Şti.');
    expect(prompt).toContain(DATA_TOOL.name);
    expect(systemPrompt(base)).not.toContain('Firmanın kendi bilgileri');
  });
});

describe('reading the model answer', () => {
  it('treats a soru_sor call as a raised hand', () => {
    expect(readOutcome({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'soru_sor', input: { soru: ' Hangi dile? ' } }] }))
      .toEqual({ kind: 'question', question: 'Hangi dile?' });
  });

  it('collects the files the sandbox produced, once each, and the closing note', () => {
    const content = [
      { type: 'server_tool_use', id: 'x' },
      { type: 'bash_code_execution_tool_result', content: { type: 'bash_code_execution_result', content: [{ type: 'bash_code_execution_output', file_id: 'file_a' }] } },
      { type: 'text_editor_code_execution_tool_result', content: { file_id: 'file_b' } },
      { type: 'bash_code_execution_tool_result', content: { content: [{ file_id: 'file_a' }] } },
      { type: 'text', text: 'Belge hazır.' },
    ];
    expect(outputFileIds(content)).toEqual(['file_a', 'file_b']);
    expect(readOutcome({ stop_reason: 'end_turn', content })).toEqual({ kind: 'delivered', summary: 'Belge hazır.', fileIds: ['file_a', 'file_b'] });
  });

  it('reports a refusal and an unfinished turn instead of an empty delivery', () => {
    expect(readOutcome({ stop_reason: 'refusal', content: [] })).toEqual({ kind: 'refused' });
    expect(readOutcome({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'yarım' }] })).toEqual({ kind: 'incomplete' });
  });

  it('reads record lookups and calls a run that stopped mid-lookup unfinished', () => {
    const content = [{ type: 'tool_use', id: 'tu_1', name: 'firma_verisi', input: { category: 'orders', query: 'RF-1' } }, { type: 'tool_use', id: 'tu_2', name: 'soru_sor', input: { soru: 'x' } }];
    expect(dataCalls(content)).toEqual([{ id: 'tu_1', category: 'orders', query: 'RF-1' }]);
    expect(readOutcome({ stop_reason: 'tool_use', content: content.slice(0, 1) })).toEqual({ kind: 'incomplete' });
  });

  it('keeps file names safe and readable', () => {
    expect(safeFileName('../../etc/passwd', 'x')).toBe('passwd');
    expect(safeFileName('/mnt/outputs/teklif sunumu.pptx', 'x')).toBe('teklif_sunumu.pptx');
    expect(safeFileName('..', 'dosya-1')).toBe('dosya-1');
    expect(textFileName('Geciken teslimat için özür')).toBe('geciken-teslimat-icin-ozur.txt');
  });
});
