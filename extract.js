var cacache = require('cacache')
var chownr = require('chownr')
var info = require('./info')

module.export = extract
function extract (cache, registry, spec, destination, opts, cb) {
  info(cache, registry, spec, function (err, digest) {
    if (err) { return cb(err) }
    cacache.get.extract(cache, digest, destination, {}, function (err) {
      if (err) { return cb(err) }
      if (typeof opts.uid === 'number' && typeof opts.gid === 'number' && process.getuid) {
        chownr(destination, opts.uid, opts.gid, cb)
      } else {
        cb()
      }
    })
  })
}
