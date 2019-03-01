'use strict'

const esDefaultRoles = [
  'apm_system',
  'apm_user',
  'beats_admin',
  'beats_system',
  'code_admin',
  'code_user',
  'ingest_admin',
  'kibana_dashboard_only_user',
  'kibana_system',
  'kibana_user',
  'logstash_admin',
  'logstash_system',
  'machine_learning_admin',
  'machine_learning_user',
  'monitoring_user',
  'remote_monitoring_agent',
  'remote_monitoring_collector',
  'reporting_user',
  'rollup_admin',
  'rollup_user',
  'snapshot_user',
  'superuser',
  'transport_client',
  'watcher_admin',
  'watcher_user'
]

const esDefaultUsers = [
  'apm_system',
  'beats_system',
  'elastic',
  'logstash_system',
  'kibana',
  'remote_monitoring_user'
]

function runInParallel (client, operation, options) {
  if (options.length === 0) return Promise.resolve()
  const operations = options.map(opts => {
    const api = delve(client, operation).bind(client)
    return api(opts)
  })

  return Promise.all(operations)
}

// code from https://github.com/developit/dlv
// needed to support an edge case: `a\.b`
// where `a.b` is a single field: { 'a.b': true }
function delve (obj, key, def, p) {
  p = 0
  // handle the key with a dot inside that is not a part of the path
  // and removes the backslashes from the key
  key = key.split
    ? key.split(/(?<!\\)\./g).map(k => k.replace(/\\/g, ''))
    : key.replace(/\\/g, '')
  while (obj && p < key.length) obj = obj[key[p++]]
  return (obj === undefined || p < key.length) ? def : obj
}

module.exports = { runInParallel, esDefaultRoles, esDefaultUsers, delve }
