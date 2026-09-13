import mongoose from 'mongoose';

const mcpOAuthClientSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecretHash: { type: String, required: true, select: false },
    clientName: { type: String, default: 'MCP Client', maxlength: 200 },
    redirectUris: {
      type: [String],
      required: true,
      validate: {
        validator: (uris) => Array.isArray(uris) && uris.length > 0,
        message: 'At least one redirect URI is required',
      },
    },
    grantTypes: { type: [String], default: ['authorization_code'] },
    responseTypes: { type: [String], default: ['code'] },
    tokenEndpointAuthMethod: {
      type: String,
      enum: ['client_secret_basic', 'client_secret_post', 'none'],
      default: 'client_secret_basic',
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    lastUsed: {
      type: Date,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const McpOAuthClient = mongoose.model('McpOAuthClient', mcpOAuthClientSchema);

export default McpOAuthClient;
