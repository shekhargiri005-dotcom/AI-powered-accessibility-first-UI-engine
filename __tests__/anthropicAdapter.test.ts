import { AnthropicAdapter } from '../lib/ai/adapters/anthropic';

describe('AnthropicAdapter', () => {
  const originalEnv = process.env;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws when getting key if neither given nor in env', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const adapter = new AnthropicAdapter();
      await expect(adapter.generate({ model: 'claude', messages: [] })).rejects.toThrow(/ANTHROPIC_API_KEY is not set/);
    });

    it('uses explicit key', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: 'response' }] })
      } as Response);
      const adapter = new AnthropicAdapter('explicit-key');
      await adapter.generate({ model: 'claude', messages: [] });
      expect(fetchSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'explicit-key'
        })
      }));
    });
  });

  describe('generate', () => {
    it('sends correct format and extracts text', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'hello claude' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      } as Response);

      const adapter = new AnthropicAdapter('key');
      const res = await adapter.generate({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'system', content: 'sys block' }, { role: 'user', content: 'hi' }]
      });

      expect(res.content).toBe('hello claude');
      expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
      expect(fetchSpy).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'anthropic-version': '2023-06-01' }),
      }));

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.system).toBe('sys block');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(body.max_tokens).toBe(4096); // opus caps at 4096
    });

    it('injects JSON directive when responseFormat is json_object', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] })
      } as Response);

      const adapter = new AnthropicAdapter('key');
      await adapter.generate({
        model: 'claude-3-sonnet',
        messages: [{ role: 'system', content: 'do task' }],
        responseFormat: 'json_object'
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.system).toContain('IMPORTANT: Return ONLY valid JSON');
    });

    it('throws an error if fetch fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      } as Response);

      const adapter = new AnthropicAdapter('key');
      await expect(adapter.generate({ model: 'claude', messages: [] })).rejects.toThrow(/HTTP 400 — Bad Request/);
    });
  });

  describe('stream', () => {
    it('yields deltas from stream events', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type": "content_block_delta", "delta": {"type": "text", "text": "hel"}}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"type": "content_block_delta", "delta": {"type": "text", "text": "lo"}}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"type": "message_stop"}\n\n'));
          controller.close();
        }
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      } as Response);

      const adapter = new AnthropicAdapter('key');
      const chunks = [];
      for await (const chunk of adapter.stream({ model: 'claude', messages: [] })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { delta: 'hel', done: false },
        { delta: 'lo', done: false },
        { delta: '', done: true }
      ]);
      
      const reqOpts = fetchSpy.mock.calls[0][1];
      const body = JSON.parse(reqOpts.body);
      expect(body.stream).toBe(true);
    });

    it('throws if stream fetch fails', async () => {
       fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      const adapter = new AnthropicAdapter('key');
      try {
        for await (const _ of adapter.stream({ model: 'claude', messages: [] })) { }
        fail('should have thrown');
      } catch (e: any) {
        expect(e.message).toMatch(/stream: API error HTTP 401/);
      }
    });

    it('throws if body is null', async () => {
      fetchSpy.mockResolvedValueOnce({
       ok: true, // ok but missing body
       body: null
     } as Response);

     const adapter = new AnthropicAdapter('key');
     try {
       for await (const _ of adapter.stream({ model: 'claude', messages: [] })) { }
       fail('should have thrown');
     } catch (e: any) {
       expect(e.message).toMatch(/stream response has no body/);
     }
   });
  });
});
