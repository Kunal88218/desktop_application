/**
 * User-facing error sanitization and formatting utilities.
 * Strips sensitive local file paths, raw OS codes, and stack traces.
 */

function sanitizeUserErrorMessage(rawError, fallback = 'An unexpected error occurred.') {
  if (!rawError) {
    return fallback;
  }

  const errorString = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));
  const str = errorString.trim();

  // Pattern-based friendly replacements
  if (/is not valid JSON|Unexpected token|JSON\.parse/i.test(str)) {
    return 'The selected file contains invalid or corrupted JSON data.';
  }
  if (/does not contain a valid tasks array/i.test(str)) {
    return 'The selected file does not contain a valid tasks list.';
  }
  if (/No valid tasks could be extracted/i.test(str)) {
    return 'No valid tasks could be found in the imported file.';
  }
  if (/corrupted/i.test(str)) {
    return 'Task data was corrupted. Safe backup tasks loaded.';
  }
  if (/ENOENT|no such file/i.test(str)) {
    return 'The requested file or destination could not be found.';
  }
  if (/EACCES|EPERM|permission denied/i.test(str)) {
    return 'Access was denied. Please check file permissions.';
  }
  if (/Invalid task list format/i.test(str)) {
    return 'Invalid data format: tasks must be provided as a list.';
  }

  // Strip sensitive absolute paths
  let cleaned = str.replace(/(?:\/[a-zA-Z0-9._-]+)+/g, '[file]');
  cleaned = cleaned.replace(/[a-zA-Z]:\\[a-zA-Z0-9._\-\\]+/g, '[file]');

  // Strip error prefixes like "Error: ", "ENOENT: "
  cleaned = cleaned.replace(/^[A-Z0-9_]+:\s*/i, '');

  // Strip stack trace lines
  cleaned = cleaned.split('\n')[0].trim();

  return cleaned || fallback;
}

module.exports = {
  sanitizeUserErrorMessage
};
