/**
 * Property-based tests for BedrockClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BedrockClient } from '../src/bedrock.js';
import { WorkPatternSummary } from '../src/aggregator.js';
import fc from 'fast-check';

describe('BedrockClient - Property Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  /**
   * **Validates: Requirements 7.6, 11.7**
   * 
   * Property 15: AWS Credential Security
   * For any execution of the tool, AWS credentials should never appear in any output,
   * logs, or error messages.
   */
  it('should never expose AWS credentials in any output or error messages', async () => {
    // Generate arbitrary AWS credentials
    const awsCredentialArbitrary = fc.record({
      accessKeyId: fc.string({ minLength: 16, maxLength: 128 }),
      secretAccessKey: fc.string({ minLength: 40, maxLength: 128 }),
      sessionToken: fc.option(fc.string({ minLength: 100, maxLength: 500 }), { nil: undefined }),
      region: fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'),
    });

    // Generate arbitrary work pattern summaries
    const workPatternArbitrary = fc.record({
      totalRepos: fc.integer({ min: 0, max: 100 }),
      activeRepos: fc.integer({ min: 0, max: 100 }),
      coldRepos: fc.integer({ min: 0, max: 100 }),
      totalCommits: fc.integer({ min: 0, max: 1000 }),
      commitDistribution: fc.constantFrom('focused', 'clustered', 'spread', 'sparse'),
      topLanguages: fc.array(
        fc.record({
          language: fc.constantFrom('TypeScript', 'JavaScript', 'Python', 'Java', 'Go'),
          percentage: fc.integer({ min: 1, max: 100 }),
        }),
        { maxLength: 5 }
      ),
      mostActiveRepos: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
      timeRange: fc.record({
        start: fc.date(),
        end: fc.date(),
      }),
    });

    await fc.assert(
      fc.asyncProperty(
        awsCredentialArbitrary,
        workPatternArbitrary,
        async (credentials, summary) => {
          // Set AWS credentials in environment
          process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
          process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
          if (credentials.sessionToken) {
            process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
          }
          process.env.AWS_REGION = credentials.region;

          // Create client
          const client = new BedrockClient(credentials.region);

          // Capture all console output
          const consoleOutput: string[] = [];
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;
          const originalInfo = console.info;

          console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
          };
          console.error = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
          };
          console.warn = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
          };
          console.info = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
          };

          try {
            // Mock the Bedrock client to simulate various scenarios
            const mockSend = vi.fn();
            
            // Randomly choose between success and error scenarios
            const shouldSucceed = Math.random() > 0.5;
            
            if (shouldSucceed) {
              // Success case
              mockSend.mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                  content: [{ text: 'Test summary response' }]
                }))
              });
            } else {
              // Error case - simulate various error types
              const errorTypes = [
                new Error('Model not found'),
                new Error('Access denied'),
                new Error('Invalid request'),
                new Error('Network timeout'),
              ];
              const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
              mockSend.mockRejectedValue(randomError);
            }

            // Replace the client's send method
            (client as any).client.send = mockSend;

            let errorMessage = '';
            try {
              await client.generateVibeCheck(summary as WorkPatternSummary);
            } catch (error) {
              if (error instanceof Error) {
                errorMessage = error.message;
              }
            }

            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;

            // Check that credentials never appear in any output
            const allOutput = [...consoleOutput, errorMessage].join('\n');

            // Verify AWS credentials are not exposed
            expect(allOutput).not.toContain(credentials.accessKeyId);
            expect(allOutput).not.toContain(credentials.secretAccessKey);
            if (credentials.sessionToken) {
              expect(allOutput).not.toContain(credentials.sessionToken);
            }

            // Also check that partial credentials are not exposed (first 8 chars)
            if (credentials.accessKeyId.length >= 8) {
              const partialKey = credentials.accessKeyId.substring(0, 8);
              if (partialKey.length >= 8) {
                // Only check if it's a meaningful substring
                expect(allOutput).not.toContain(partialKey);
              }
            }

            if (credentials.secretAccessKey.length >= 8) {
              const partialSecret = credentials.secretAccessKey.substring(0, 8);
              if (partialSecret.length >= 8) {
                expect(allOutput).not.toContain(partialSecret);
              }
            }

          } finally {
            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.6, 11.7**
   * 
   * Property 15b: AWS Credential Security in Error Messages
   * When Bedrock API calls fail, error messages should not contain AWS credentials.
   */
  it('should not expose credentials in error messages when API calls fail', async () => {
    const credentialArbitrary = fc.record({
      accessKeyId: fc.string({ minLength: 20, maxLength: 128 }),
      secretAccessKey: fc.string({ minLength: 40, maxLength: 128 }),
    });

    const errorMessageArbitrary = fc.constantFrom(
      'Model not found',
      'Access denied',
      'Invalid request format',
      'Rate limit exceeded',
      'Network connection failed',
      'Timeout waiting for response'
    );

    await fc.assert(
      fc.asyncProperty(
        credentialArbitrary,
        errorMessageArbitrary,
        async (credentials, errorMsg) => {
          // Set credentials
          process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
          process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;

          const client = new BedrockClient();

          // Mock the client to throw an error
          const mockSend = vi.fn().mockRejectedValue(new Error(errorMsg));
          (client as any).client.send = mockSend;

          // Create a minimal valid summary
          const summary: WorkPatternSummary = {
            totalRepos: 1,
            activeRepos: 1,
            coldRepos: 0,
            totalCommits: 5,
            commitDistribution: 'focused',
            topLanguages: [{ language: 'TypeScript', percentage: 100 }],
            mostActiveRepos: ['test-repo'],
            timeRange: { start: new Date(), end: new Date() },
          };

          let caughtError: Error | null = null;
          try {
            await client.generateVibeCheck(summary);
          } catch (error) {
            caughtError = error as Error;
          }

          // Verify an error was thrown
          expect(caughtError).not.toBeNull();
          
          if (caughtError) {
            // Verify credentials are not in the error message
            expect(caughtError.message).not.toContain(credentials.accessKeyId);
            expect(caughtError.message).not.toContain(credentials.secretAccessKey);
            
            // Verify error stack doesn't contain credentials
            if (caughtError.stack) {
              expect(caughtError.stack).not.toContain(credentials.accessKeyId);
              expect(caughtError.stack).not.toContain(credentials.secretAccessKey);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 7.6, 11.7**
   * 
   * Property 15c: AWS Credential Security in Prompt Building
   * The prompt building process should not leak credentials.
   */
  it('should not include credentials in prompts sent to Bedrock', async () => {
    const credentialArbitrary = fc.record({
      accessKeyId: fc.string({ minLength: 20, maxLength: 128 }),
      secretAccessKey: fc.string({ minLength: 40, maxLength: 128 }),
    });

    const summaryArbitrary = fc.record({
      totalRepos: fc.integer({ min: 0, max: 50 }),
      activeRepos: fc.integer({ min: 0, max: 50 }),
      coldRepos: fc.integer({ min: 0, max: 50 }),
      totalCommits: fc.integer({ min: 0, max: 500 }),
      commitDistribution: fc.constantFrom('focused', 'clustered', 'spread', 'sparse'),
      topLanguages: fc.array(
        fc.record({
          language: fc.string({ minLength: 1, maxLength: 20 }),
          percentage: fc.integer({ min: 1, max: 100 }),
        }),
        { maxLength: 5 }
      ),
      mostActiveRepos: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 3 }),
      timeRange: fc.record({
        start: fc.date(),
        end: fc.date(),
      }),
    });

    await fc.assert(
      fc.asyncProperty(
        credentialArbitrary,
        summaryArbitrary,
        async (credentials, summary) => {
          // Set credentials
          process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
          process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;

          const client = new BedrockClient();

          // Mock the client to capture the request
          let capturedRequest: any = null;
          const mockSend = vi.fn().mockImplementation((command) => {
            capturedRequest = command;
            return Promise.resolve({
              body: new TextEncoder().encode(JSON.stringify({
                content: [{ text: 'Test response' }]
              }))
            });
          });
          (client as any).client.send = mockSend;

          await client.generateVibeCheck(summary as WorkPatternSummary);

          // Verify the request was captured
          expect(capturedRequest).not.toBeNull();

          if (capturedRequest) {
            // Get the request body
            const requestBody = capturedRequest.input.body;
            
            // Verify credentials are not in the request
            expect(requestBody).not.toContain(credentials.accessKeyId);
            expect(requestBody).not.toContain(credentials.secretAccessKey);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * **Validates: Requirements 7.7, 11.6**
 *
 * Property 16: Secure Bedrock Communication
 * The Bedrock client should use AWS SDK for secure communication and validate
 * API responses before processing them.
 */
it('should use AWS SDK for secure communication and validate responses', async () => {
  const summaryArbitrary = fc.record({
    totalRepos: fc.integer({ min: 0, max: 50 }),
    activeRepos: fc.integer({ min: 0, max: 50 }),
    coldRepos: fc.integer({ min: 0, max: 50 }),
    totalCommits: fc.integer({ min: 0, max: 500 }),
    commitDistribution: fc.constantFrom('focused', 'clustered', 'spread', 'sparse'),
    topLanguages: fc.array(
      fc.record({
        language: fc.string({ minLength: 1, maxLength: 20 }),
        percentage: fc.integer({ min: 1, max: 100 }),
      }),
      { maxLength: 5 }
    ),
    mostActiveRepos: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 3 }),
    timeRange: fc.record({
      start: fc.date(),
      end: fc.date(),
    }),
  });

  // Test various response scenarios
  const responseScenarioArbitrary = fc.constantFrom(
    'valid',
    'missing_content',
    'empty_content',
    'invalid_json',
    'missing_text',
    'null_body'
  );

  await fc.assert(
    fc.asyncProperty(
      summaryArbitrary,
      responseScenarioArbitrary,
      async (summary, scenario) => {
        const client = new BedrockClient();

        // Verify the client uses AWS SDK BedrockRuntimeClient
        expect((client as any).client).toBeDefined();
        expect((client as any).client.constructor.name).toBe('BedrockRuntimeClient');

        // Mock the send method to test response validation
        const mockSend = vi.fn();

        switch (scenario) {
          case 'valid':
            // Valid response with proper structure
            mockSend.mockResolvedValue({
              body: new TextEncoder().encode(JSON.stringify({
                content: [{ text: 'Valid summary response' }]
              }))
            });
            break;

          case 'missing_content':
            // Response without content field
            mockSend.mockResolvedValue({
              body: new TextEncoder().encode(JSON.stringify({}))
            });
            break;

          case 'empty_content':
            // Response with empty content array
            mockSend.mockResolvedValue({
              body: new TextEncoder().encode(JSON.stringify({
                content: []
              }))
            });
            break;

          case 'invalid_json':
            // Response with invalid JSON
            mockSend.mockResolvedValue({
              body: new TextEncoder().encode('not valid json')
            });
            break;

          case 'missing_text':
            // Response with content but no text field
            mockSend.mockResolvedValue({
              body: new TextEncoder().encode(JSON.stringify({
                content: [{ type: 'text' }]
              }))
            });
            break;

          case 'null_body':
            // Response with null body
            mockSend.mockResolvedValue({
              body: null
            });
            break;
        }

        (client as any).client.send = mockSend;

        if (scenario === 'valid') {
          // Valid response should succeed
          const result = await client.generateVibeCheck(summary as WorkPatternSummary);
          expect(result).toBe('Valid summary response');
          expect(mockSend).toHaveBeenCalledTimes(1);

          // Verify the command uses proper AWS SDK structure
          const command = mockSend.mock.calls[0][0];
          expect(command.constructor.name).toBe('InvokeModelCommand');
          expect(command.input.modelId).toBeDefined();
          expect(command.input.contentType).toBe('application/json');
          expect(command.input.accept).toBe('application/json');
        } else {
          // Invalid responses should throw errors (validation)
          await expect(
            client.generateVibeCheck(summary as WorkPatternSummary)
          ).rejects.toThrow();

          // Verify the client attempted to validate the response
          expect(mockSend).toHaveBeenCalledTimes(1);
        }
      }
    ),
    { numRuns: 50 }
  );
});

/**
 * **Validates: Requirements 7.7, 11.6**
 *
 * Property 16b: Response Validation Before Processing
 * The client should validate response structure before attempting to extract text.
 */
it('should validate response structure before processing', async () => {
  const malformedResponseArbitrary = fc.oneof(
    // Missing content field
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({})) }),
    // Empty content array
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({ content: [] })) }),
    // Content without text
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({ content: [{}] })) }),
    // Content with wrong type
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({ content: [{ type: 'image' }] })) }),
    // Null content
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({ content: null })) }),
    // Content is not an array
    fc.constant({ body: new TextEncoder().encode(JSON.stringify({ content: 'not an array' })) })
  );

  await fc.assert(
    fc.asyncProperty(malformedResponseArbitrary, async (response) => {
      const client = new BedrockClient();

      // Mock the send method with malformed response
      const mockSend = vi.fn().mockResolvedValue(response);
      (client as any).client.send = mockSend;

      const summary: WorkPatternSummary = {
        totalRepos: 1,
        activeRepos: 1,
        coldRepos: 0,
        totalCommits: 5,
        commitDistribution: 'focused',
        topLanguages: [{ language: 'TypeScript', percentage: 100 }],
        mostActiveRepos: ['test-repo'],
        timeRange: { start: new Date(), end: new Date() },
      };

      // Should throw an error due to validation failure
      await expect(client.generateVibeCheck(summary)).rejects.toThrow();
    }),
    { numRuns: 30 }
  );
});

/**
 * **Validates: Requirements 7.7**
 *
 * Property 16c: AWS SDK Usage for All Requests
 * All Bedrock API calls should go through the AWS SDK client.
 */
it('should use AWS SDK client for all API requests', async () => {
  const regionArbitrary = fc.constantFrom(
    'us-east-1',
    'us-west-2',
    'eu-west-1',
    'ap-southeast-1',
    'ap-northeast-1'
  );

  const modelIdArbitrary = fc.constantFrom(
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
  );

  await fc.assert(
    fc.asyncProperty(
      regionArbitrary,
      modelIdArbitrary,
      async (region, modelId) => {
        const client = new BedrockClient(region, modelId);

        // Verify the client is an instance of AWS SDK BedrockRuntimeClient
        const internalClient = (client as any).client;
        expect(internalClient).toBeDefined();
        expect(internalClient.constructor.name).toBe('BedrockRuntimeClient');

        // Verify the client has the send method (AWS SDK interface)
        expect(typeof internalClient.send).toBe('function');

        // Mock the send method to capture the command
        let capturedCommand: any = null;
        const mockSend = vi.fn().mockImplementation((command) => {
          capturedCommand = command;
          return Promise.resolve({
            body: new TextEncoder().encode(JSON.stringify({
              content: [{ text: 'Test response' }]
            }))
          });
        });
        internalClient.send = mockSend;

        const summary: WorkPatternSummary = {
          totalRepos: 1,
          activeRepos: 1,
          coldRepos: 0,
          totalCommits: 5,
          commitDistribution: 'focused',
          topLanguages: [{ language: 'TypeScript', percentage: 100 }],
          mostActiveRepos: ['test-repo'],
          timeRange: { start: new Date(), end: new Date() },
        };

        await client.generateVibeCheck(summary);

        // Verify the command is an InvokeModelCommand from AWS SDK
        expect(capturedCommand).not.toBeNull();
        expect(capturedCommand.constructor.name).toBe('InvokeModelCommand');

        // Verify the command has proper AWS SDK structure
        expect(capturedCommand.input).toBeDefined();
        expect(capturedCommand.input.modelId).toBe(modelId);
        expect(capturedCommand.input.contentType).toBe('application/json');
        expect(capturedCommand.input.accept).toBe('application/json');
        expect(capturedCommand.input.body).toBeDefined();

        // Verify the request body is properly formatted
        const requestBody = JSON.parse(capturedCommand.input.body);
        expect(requestBody.anthropic_version).toBe('bedrock-2023-05-31');
        expect(requestBody.max_tokens).toBe(200);
        expect(requestBody.messages).toBeDefined();
        expect(Array.isArray(requestBody.messages)).toBe(true);
      }
    ),
    { numRuns: 30 }
  );
});


/**
 * **Validates: Requirements 11.6**
 *
 * Property 21: API Response Validation
 * For any response from the Bedrock API, the response should be validated before
 * processing to ensure it contains the expected structure. Malformed responses
 * should be rejected with clear error messages.
 */
it('should validate all API responses before processing them', async () => {
  // Generate arbitrary response structures including valid and invalid ones
  const responseArbitrary = fc.oneof(
    // Valid response
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'Valid response text' }]
      }))
    }),
    // Missing content field
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({}))
    }),
    // Null content
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: null }))
    }),
    // Content is not an array
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: 'not an array' }))
    }),
    // Empty content array
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: [] }))
    }),
    // Content array with no text field
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: [{}] }))
    }),
    // Content array with null text
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: [{ text: null }] }))
    }),
    // Content array with empty string text
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: [{ text: '' }] }))
    }),
    // Content array with non-string text
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({ content: [{ text: 123 }] }))
    }),
    // Invalid JSON
    fc.constant({
      body: new TextEncoder().encode('not valid json {')
    }),
    // Null body
    fc.constant({
      body: null
    }),
    // Undefined body
    fc.constant({
      body: undefined
    }),
    // Multiple content items (should use first)
    fc.constant({
      body: new TextEncoder().encode(JSON.stringify({
        content: [
          { text: 'First text' },
          { text: 'Second text' }
        ]
      }))
    })
  );

  await fc.assert(
    fc.asyncProperty(responseArbitrary, async (response) => {
      const client = new BedrockClient();

      // Mock the send method with the generated response
      const mockSend = vi.fn().mockResolvedValue(response);
      (client as any).client.send = mockSend;

      const summary: WorkPatternSummary = {
        totalRepos: 1,
        activeRepos: 1,
        coldRepos: 0,
        totalCommits: 5,
        commitDistribution: 'focused',
        topLanguages: [{ language: 'TypeScript', percentage: 100 }],
        mostActiveRepos: ['test-repo'],
        timeRange: { start: new Date(), end: new Date() },
      };

      // Determine if this response should be valid
      const isValidResponse = response.body &&
        (() => {
          try {
            const decoded = new TextDecoder().decode(response.body);
            const parsed = JSON.parse(decoded);
            return parsed.content &&
                   Array.isArray(parsed.content) &&
                   parsed.content.length > 0 &&
                   typeof parsed.content[0].text === 'string' &&
                   parsed.content[0].text.length > 0;
          } catch {
            return false;
          }
        })();

      if (isValidResponse) {
        // Valid responses should succeed and return the text
        const result = await client.generateVibeCheck(summary);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        
        // Verify that send was called once
        expect(mockSend).toHaveBeenCalledTimes(1);
      } else {
        // Invalid responses should throw an error with validation message
        let caughtError: Error | null = null;
        try {
          await client.generateVibeCheck(summary);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          caughtError = error as Error;
        }
        
        // Verify error was thrown and is an Error instance
        expect(caughtError).toBeInstanceOf(Error);
        
        if (caughtError) {
          // Error message should indicate the problem
          expect(caughtError.message).toBeTruthy();
          expect(caughtError.message.length).toBeGreaterThan(0);
        }
        
        // Verify that send was called once
        expect(mockSend).toHaveBeenCalledTimes(1);
      }
    }),
    { numRuns: 100 }
  );
});

/**
 * **Validates: Requirements 11.6**
 *
 * Property 21b: Response Validation Error Messages
 * When API response validation fails, the error message should clearly indicate
 * the validation failure without exposing sensitive information.
 */
it('should provide clear error messages for validation failures', async () => {
  const invalidResponseArbitrary = fc.constantFrom(
    { body: new TextEncoder().encode(JSON.stringify({})), expectedError: 'No content' },
    { body: new TextEncoder().encode(JSON.stringify({ content: [] })), expectedError: 'No content' },
    { body: new TextEncoder().encode(JSON.stringify({ content: [{}] })), expectedError: 'Invalid or empty text' },
    { body: new TextEncoder().encode(JSON.stringify({ content: [{ text: '' }] })), expectedError: 'Invalid or empty text' },
    { body: new TextEncoder().encode('invalid json'), expectedError: 'Error calling Bedrock API' }
  );

  await fc.assert(
    fc.asyncProperty(invalidResponseArbitrary, async ({ body, expectedError }) => {
      const client = new BedrockClient();

      // Mock the send method with invalid response
      const mockSend = vi.fn().mockResolvedValue({ body });
      (client as any).client.send = mockSend;

      const summary: WorkPatternSummary = {
        totalRepos: 1,
        activeRepos: 1,
        coldRepos: 0,
        totalCommits: 5,
        commitDistribution: 'focused',
        topLanguages: [{ language: 'TypeScript', percentage: 100 }],
        mostActiveRepos: ['test-repo'],
        timeRange: { start: new Date(), end: new Date() },
      };

      let caughtError: Error | null = null;
      try {
        await client.generateVibeCheck(summary);
      } catch (error) {
        caughtError = error as Error;
      }

      // Verify error was thrown
      expect(caughtError).not.toBeNull();

      if (caughtError) {
        // Verify error message contains expected validation error
        expect(caughtError.message).toContain(expectedError);

        // Verify error message doesn't contain raw response data
        expect(caughtError.message).not.toContain('[object Object]');
      }
    }),
    { numRuns: 30 }
  );
});

/**
 * **Validates: Requirements 11.6**
 *
 * Property 21c: Response Validation Before Text Extraction
 * The client must validate the response structure before attempting to extract
 * text content, preventing runtime errors from malformed responses.
 */
it('should validate response structure before extracting text content', async () => {
  // Generate various malformed response structures
  const malformedStructureArbitrary = fc.oneof(
    // Content with wrong structure
    fc.constant({ content: { text: 'wrong structure' } }),
    // Content with nested arrays
    fc.constant({ content: [[{ text: 'nested' }]] }),
    // Content with text at wrong level
    fc.constant({ text: 'wrong level' }),
    // Content array with mixed types
    fc.constant({ content: ['string', { text: 'object' }, 123] }),
    // Content with undefined text
    fc.constant({ content: [{ text: undefined }] }),
    // Content with object instead of string text
    fc.constant({ content: [{ text: { nested: 'object' } }] })
  );

  await fc.assert(
    fc.asyncProperty(malformedStructureArbitrary, async (responseData) => {
      const client = new BedrockClient();

      // Mock the send method with malformed structure
      const mockSend = vi.fn().mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(responseData))
      });
      (client as any).client.send = mockSend;

      const summary: WorkPatternSummary = {
        totalRepos: 1,
        activeRepos: 1,
        coldRepos: 0,
        totalCommits: 5,
        commitDistribution: 'focused',
        topLanguages: [{ language: 'TypeScript', percentage: 100 }],
        mostActiveRepos: ['test-repo'],
        timeRange: { start: new Date(), end: new Date() },
      };

      // Should throw an error due to validation failure
      await expect(client.generateVibeCheck(summary)).rejects.toThrow();

      // Verify the error is caught before attempting text extraction
      try {
        await client.generateVibeCheck(summary);
      } catch (error) {
        // Error should be a validation error, not a runtime error from accessing undefined
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;

        // Should not be a TypeError from accessing properties on undefined
        expect(errorMessage).not.toContain('Cannot read property');
        expect(errorMessage).not.toContain('Cannot read properties of undefined');

        // Should be a validation error
        expect(
          errorMessage.includes('No content') ||
          errorMessage.includes('Invalid or empty text') ||
          errorMessage.includes('Error calling Bedrock API')
        ).toBe(true);
      }
    }),
    { numRuns: 30 }
  );
});

