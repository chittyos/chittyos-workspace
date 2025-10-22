import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import twilio from 'twilio';
import express from 'express';
import { createHash } from 'crypto';

// ChittyOS Platform Integration
interface TelephonyConfig {
  twilioAccountSid: string;
  twilioAuthToken: string;
  chittyosApiUrl: string;
  chittyosApiKey: string;
  blockchainEnabled: boolean;
  agentRuntimeEnabled: boolean;
}

// Phone number to ChittyOS entity mapping
const PHONE_ENTITY_MAP = {
  '+13078000037': { 
    name: 'IT CAN BE LLC',
    entity: 'IT_CAN_BE_LLC',
    chittyApp: 'resolution',
    sid: 'PN3322629411be441f12588e965cc31dab'
  },
  '+18722742421': { 
    name: 'Main Line (Apps/Etc)',
    entity: 'ARIBIA_LLC',
    chittyApp: 'flow',
    sid: 'PNc1d3f68d2b98a37a41682dd63c7c93bd'
  },
  '+18722784141': { 
    name: 'Lakeside Loft',
    entity: 'LAKESIDE_LOFT',
    chittyApp: 'chronicle',
    sid: 'PNb989e1ae69cbdf6f4ae55e023b7fb734'
  },
  '+18723380002': { 
    name: 'City Studio',
    entity: 'CITY_STUDIO',
    chittyApp: 'chronicle',
    sid: 'PNc952a6f845cd2911b20e0d25428862ff'
  },
  '+18723380008': { 
    name: 'Cozy Castle',
    entity: 'COZY_CASTLE',
    chittyApp: 'chronicle',
    sid: 'PNf001215e40f72671413eb5fc07b69191'
  },
  '+18723380009': { 
    name: 'Chitty Concierge',
    entity: 'CHITTY_CONCIERGE',
    chittyApp: 'flow',
    sid: 'PNf598b356a82e4f795b7bb4157bfffffc'
  }
};

class ChittyTelephonyMCP {
  private server: Server;
  private twilioClient: any;
  private config: TelephonyConfig;
  private expressApp: express.Application;

  constructor() {
    this.config = {
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      chittyosApiUrl: process.env.CHITTYOS_API_URL || 'http://localhost:8080',
      chittyosApiKey: process.env.CHITTYOS_API_KEY || '',
      blockchainEnabled: process.env.CHITTYOS_BLOCKCHAIN_ENABLED === 'true',
      agentRuntimeEnabled: process.env.CHITTYOS_AGENT_RUNTIME_ENABLED === 'true'
    };

    this.twilioClient = twilio(this.config.twilioAccountSid, this.config.twilioAuthToken);
    this.server = new Server(
      {
        name: 'chittychat-telephony',
        version: '1.0.0',
        description: 'ChittyChat Telephony Integration with ChittyOS Platform'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.expressApp = express();
    this.setupExpress();
    this.setupTools();
  }

  private setupExpress() {
    this.expressApp.use(express.json());
    this.expressApp.use(express.urlencoded({ extended: true }));

    // Twilio webhook endpoints
    this.expressApp.post('/voice/incoming', this.handleIncomingCall.bind(this));
    this.expressApp.post('/sms/incoming', this.handleIncomingSMS.bind(this));
    this.expressApp.post('/voice/process/:entity', this.processVoiceInput.bind(this));
    
    // ChittyOS webhook endpoints  
    this.expressApp.post('/chittyos/webhook', this.handleChittyOSWebhook.bind(this));
    
    // Health check
    this.expressApp.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        telephony: 'active',
        chittyos: this.config.chittyosApiUrl ? 'connected' : 'disabled',
        blockchain: this.config.blockchainEnabled,
        agentRuntime: this.config.agentRuntimeEnabled
      });
    });
  }

  private setupTools() {
    // Telephony Tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        // Call Management
        {
          name: 'telephony_make_call',
          description: 'Make an outbound phone call',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Phone number to call' },
              from: { type: 'string', description: 'Phone number to call from' },
              message: { type: 'string', description: 'Text-to-speech message' }
            },
            required: ['to', 'message']
          }
        },
        {
          name: 'telephony_send_sms',
          description: 'Send an SMS message',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Phone number to send to' },
              from: { type: 'string', description: 'Phone number to send from' },
              body: { type: 'string', description: 'SMS message body' }
            },
            required: ['to', 'body']
          }
        },
        {
          name: 'telephony_get_call_logs',
          description: 'Get call history and logs',
          inputSchema: {
            type: 'object',
            properties: {
              phoneNumber: { type: 'string', description: 'Filter by phone number' },
              limit: { type: 'number', description: 'Number of records to return' },
              startDate: { type: 'string', description: 'Start date for logs' },
              endDate: { type: 'string', description: 'End date for logs' }
            }
          }
        },
        // Property Management Integration
        {
          name: 'telephony_route_to_property',
          description: 'Route a call to a specific property handler',
          inputSchema: {
            type: 'object',
            properties: {
              callSid: { type: 'string', description: 'Twilio Call SID' },
              property: { type: 'string', description: 'Property identifier' },
              action: { type: 'string', description: 'Action to take (transfer, voicemail, ai_handler)' }
            },
            required: ['callSid', 'property', 'action']
          }
        },
        // Blockchain Evidence Logging
        {
          name: 'telephony_log_to_blockchain',
          description: 'Log call/SMS to blockchain for evidence tracking',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'call or sms' },
              from: { type: 'string', description: 'Caller/sender' },
              to: { type: 'string', description: 'Recipient' },
              content: { type: 'string', description: 'Transcript or message content' },
              metadata: { type: 'object', description: 'Additional metadata' }
            },
            required: ['type', 'from', 'to']
          }
        },
        // Agent Runtime Integration
        {
          name: 'telephony_create_agent_task',
          description: 'Create agent task from telephony interaction',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Task type (maintenance_request, payment_inquiry, etc)' },
              priority: { type: 'number', description: 'Priority 1-5' },
              property: { type: 'string', description: 'Property identifier' },
              caller: { type: 'string', description: 'Caller phone number' },
              details: { type: 'object', description: 'Task details' }
            },
            required: ['type', 'property', 'details']
          }
        }
      ]
    }));

    // Tool implementations
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'telephony_make_call':
          return await this.makeCall(args);
        
        case 'telephony_send_sms':
          return await this.sendSMS(args);
        
        case 'telephony_get_call_logs':
          return await this.getCallLogs(args);
        
        case 'telephony_route_to_property':
          return await this.routeToProperty(args);
        
        case 'telephony_log_to_blockchain':
          return await this.logToBlockchain(args);
        
        case 'telephony_create_agent_task':
          return await this.createAgentTask(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async makeCall(args: any) {
    try {
      const call = await this.twilioClient.calls.create({
        to: args.to,
        from: args.from || process.env.PHONE_MAIN_LINE,
        twiml: `<Response><Say>${args.message}</Say></Response>`
      });

      // Log to blockchain if enabled
      if (this.config.blockchainEnabled) {
        await this.logToBlockchain({
          type: 'call',
          from: args.from || process.env.PHONE_MAIN_LINE,
          to: args.to,
          content: args.message,
          metadata: { callSid: call.sid }
        });
      }

      return {
        content: [{
          type: 'text',
          text: `Call initiated successfully. SID: ${call.sid}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error making call: ${error.message}`
        }]
      };
    }
  }

  private async sendSMS(args: any) {
    try {
      const message = await this.twilioClient.messages.create({
        to: args.to,
        from: args.from || process.env.PHONE_MAIN_LINE,
        body: args.body
      });

      // Log to blockchain if enabled
      if (this.config.blockchainEnabled) {
        await this.logToBlockchain({
          type: 'sms',
          from: args.from || process.env.PHONE_MAIN_LINE,
          to: args.to,
          content: args.body,
          metadata: { messageSid: message.sid }
        });
      }

      return {
        content: [{
          type: 'text',
          text: `SMS sent successfully. SID: ${message.sid}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error sending SMS: ${error.message}`
        }]
      };
    }
  }

  private async getCallLogs(args: any) {
    try {
      const calls = await this.twilioClient.calls.list({
        limit: args.limit || 20,
        startTime: args.startDate ? new Date(args.startDate) : undefined,
        endTime: args.endDate ? new Date(args.endDate) : undefined,
        to: args.phoneNumber,
        from: args.phoneNumber
      });

      const logs = calls.map(call => ({
        sid: call.sid,
        from: call.from,
        to: call.to,
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        startTime: call.startTime
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(logs, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching call logs: ${error.message}`
        }]
      };
    }
  }

  private async routeToProperty(args: any) {
    try {
      const property = PHONE_ENTITY_MAP[args.property] || null;
      if (!property) {
        throw new Error('Property not found');
      }

      // Update call routing based on action
      const call = await this.twilioClient.calls(args.callSid).update({
        twiml: this.generatePropertyTwiML(property, args.action)
      });

      return {
        content: [{
          type: 'text',
          text: `Call routed to ${property.name} with action: ${args.action}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error routing call: ${error.message}`
        }]
      };
    }
  }

  private async logToBlockchain(args: any) {
    if (!this.config.blockchainEnabled) {
      return {
        content: [{
          type: 'text',
          text: 'Blockchain logging disabled'
        }]
      };
    }

    try {
      // Create ChittyID for the communication
      const chittyId = `TEL_${args.type.toUpperCase()}_${Date.now()}_${createHash('sha256').update(args.from + args.to).digest('hex').substring(0, 8)}`;

      // Call ChittyOS blockchain service
      const response = await fetch(`${this.config.chittyosApiUrl}/api/blockchain/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.chittyosApiKey}`
        },
        body: JSON.stringify({
          chittyId,
          source: 'telephony',
          type: args.type,
          content: {
            from: args.from,
            to: args.to,
            message: args.content,
            timestamp: new Date().toISOString()
          },
          metadata: args.metadata,
          classification: 'business_communication'
        })
      });

      const result = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: `Logged to blockchain. ChittyID: ${chittyId}, Block: ${result.blockHash}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error logging to blockchain: ${error.message}`
        }]
      };
    }
  }

  private async createAgentTask(args: any) {
    if (!this.config.agentRuntimeEnabled) {
      return {
        content: [{
          type: 'text',
          text: 'Agent runtime disabled'
        }]
      };
    }

    try {
      const response = await fetch(`${this.config.chittyosApiUrl}/api/agents/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.chittyosApiKey}`
        },
        body: JSON.stringify({
          type: args.type,
          priority: args.priority || 3,
          source: 'telephony',
          property: args.property,
          caller: args.caller,
          details: args.details,
          metadata: {
            timestamp: new Date().toISOString(),
            entity: PHONE_ENTITY_MAP[args.property]?.entity
          }
        })
      });

      const task = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: `Agent task created. Task ID: ${task.id}, Assigned to: ${task.assignedAgent}`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error creating agent task: ${error.message}`
        }]
      };
    }
  }

  private async handleIncomingCall(req: any, res: any) {
    const twiml = this.twilioClient.twiml.VoiceResponse();
    const to = req.body.To;
    const from = req.body.From;
    const property = PHONE_ENTITY_MAP[to];

    console.log(`📞 Incoming call to ${property?.name || to} from ${from}`);

    if (property) {
      twiml.say(`Thank you for calling ${property.name}.`);
      
      // Create gather for voice input
      const gather = twiml.gather({
        input: 'speech',
        timeout: 30,
        action: `/voice/process/${property.entity}`,
        method: 'POST'
      });
      
      gather.say('Please state your request.');
    } else {
      twiml.say('Thank you for calling. Please hold.');
      twiml.dial(process.env.PHONE_MAIN_LINE);
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  private async handleIncomingSMS(req: any, res: any) {
    const twiml = this.twilioClient.twiml.MessagingResponse();
    const message = req.body.Body;
    const from = req.body.From;
    const to = req.body.To;
    const property = PHONE_ENTITY_MAP[to];

    console.log(`💬 SMS to ${property?.name || to}: ${message}`);

    // Process through ChittyOS
    if (property) {
      const response = await fetch(`${this.config.chittyosApiUrl}/api/sms/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.chittyosApiKey}`
        },
        body: JSON.stringify({
          entity: property.entity,
          message,
          sender: from,
          property: property.name
        })
      });

      const result = await response.json();
      twiml.message(result.reply || 'Message received. We will respond shortly.');
    } else {
      twiml.message('Thank you for your message. We will respond shortly.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  }

  private async processVoiceInput(req: any, res: any) {
    const twiml = this.twilioClient.twiml.VoiceResponse();
    const entity = req.params.entity;
    const speechResult = req.body.SpeechResult || '';
    const from = req.body.From;

    console.log(`🎤 Processing speech for ${entity}: "${speechResult}"`);

    // Send to ChittyOS for AI processing
    const response = await fetch(`${this.config.chittyosApiUrl}/api/voice/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.chittyosApiKey}`
      },
      body: JSON.stringify({
        entity,
        speech: speechResult,
        caller: from,
        context: 'voice_call'
      })
    });

    const result = await response.json();
    twiml.say(result.message || 'Thank you. We will process your request.');

    res.type('text/xml');
    res.send(twiml.toString());
  }

  private async handleChittyOSWebhook(req: any, res: any) {
    const { action, data } = req.body;

    console.log(`📡 ChittyOS Webhook: ${action}`);

    try {
      switch (action) {
        case 'send_sms':
          const smsResult = await this.twilioClient.messages.create({
            to: data.to,
            from: data.from || process.env.PHONE_MAIN_LINE,
            body: data.message
          });
          res.json({ success: true, messageSid: smsResult.sid });
          break;

        case 'make_call':
          const callResult = await this.twilioClient.calls.create({
            to: data.to,
            from: data.from || process.env.PHONE_MAIN_LINE,
            twiml: `<Response><Say>${data.message}</Say></Response>`
          });
          res.json({ success: true, callSid: callResult.sid });
          break;

        default:
          res.status(400).json({ error: 'Unknown action' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private generatePropertyTwiML(property: any, action: string): string {
    const twiml = this.twilioClient.twiml.VoiceResponse();

    switch (action) {
      case 'transfer':
        twiml.say(`Transferring to ${property.name} management.`);
        twiml.dial(process.env[`PHONE_${property.entity}`]);
        break;

      case 'voicemail':
        twiml.say(`Please leave a message for ${property.name}.`);
        twiml.record({
          action: `/voicemail/process/${property.entity}`,
          maxLength: 120,
          transcribe: true
        });
        break;

      case 'ai_handler':
        twiml.say(`Connecting you to our AI assistant for ${property.name}.`);
        twiml.redirect({
          method: 'POST'
        }, `/ai/handle/${property.entity}`);
        break;

      default:
        twiml.say('Thank you for calling.');
    }

    return twiml.toString();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Start Express server for webhooks
    const PORT = process.env.TELEPHONY_PORT || 3001;
    this.expressApp.listen(PORT, () => {
      console.log(`🚀 ChittyTelephony MCP Server running on port ${PORT}`);
      console.log(`📱 Managing ${Object.keys(PHONE_ENTITY_MAP).length} phone numbers`);
      console.log(`🔗 ChittyOS: ${this.config.chittyosApiUrl}`);
      console.log(`⛓️  Blockchain: ${this.config.blockchainEnabled ? 'enabled' : 'disabled'}`);
      console.log(`🤖 Agent Runtime: ${this.config.agentRuntimeEnabled ? 'enabled' : 'disabled'}`);
    });

    console.error('ChittyTelephony MCP server running');
  }
}

// Start the server
const server = new ChittyTelephonyMCP();
server.run().catch(console.error);