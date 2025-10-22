/**
 * ChittySync CLI - Config Command
 *
 * Manage CLI configuration (credentials, URLs, defaults).
 */

import chalk from 'chalk';

/**
 * Config command handler
 * @param {string} action - Action (set, get, list)
 * @param {string} key - Config key
 * @param {string} value - Config value (for set)
 * @param {Object} config - Config store
 */
export async function configCommand(action, key, value, config) {
  try {
    switch (action) {
      case 'set':
        if (!key || value === undefined) {
          console.log(chalk.red('Usage: chittysync config set <key> <value>'));
          process.exit(1);
        }
        config.set(key, value);
        console.log(chalk.green(`✓ Set ${key} = ${maskSensitive(key, value)}`));
        break;

      case 'get':
        if (!key) {
          console.log(chalk.red('Usage: chittysync config get <key>'));
          process.exit(1);
        }
        const getValue = config.get(key);
        if (getValue === undefined) {
          console.log(chalk.yellow(`Key not found: ${key}`));
        } else {
          console.log(`${key} = ${maskSensitive(key, getValue)}`);
        }
        break;

      case 'list':
        const all = config.store;
        console.log(chalk.bold('Configuration:'));
        Object.entries(all).forEach(([k, v]) => {
          console.log(`  ${k} = ${maskSensitive(k, v)}`);
        });
        break;

      case 'delete':
      case 'remove':
        if (!key) {
          console.log(chalk.red('Usage: chittysync config delete <key>'));
          process.exit(1);
        }
        config.delete(key);
        console.log(chalk.green(`✓ Deleted ${key}`));
        break;

      case 'clear':
        config.clear();
        console.log(chalk.green('✓ Configuration cleared'));
        break;

      case 'path':
        console.log(chalk.gray('Config file location:'));
        console.log(config.path);
        break;

      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log('Available actions: set, get, list, delete, clear, path');
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Config error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Mask sensitive values in output
 * @param {string} key - Config key
 * @param {string} value - Config value
 * @returns {string} Masked value
 */
function maskSensitive(key, value) {
  const sensitiveKeys = [
    'token',
    'key',
    'secret',
    'password',
    'api_key',
    'chitty_id_token',
    'google_api_key',
    'cloudflare_api_token',
    'neon_api_key',
    'github_token'
  ];

  const isSensitive = sensitiveKeys.some(k =>
    key.toLowerCase().includes(k)
  );

  if (isSensitive && typeof value === 'string' && value.length > 8) {
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  return value;
}
