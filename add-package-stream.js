var cacache = require('cacache')
var register = require('./register')
var path = require('path')
var readJson = require('read-package-json')

module.exports = addPackageStream
function addPackageStream (cache, registry, spec, tarStream, opts, cb) {
  var sawIgnores = {}
  cacache.put.stream(cache, tarStream, {
    hash: opts.hash || 'sha256',
    logger: opts.logger,
    strip: 1, // remove `package/` from path

    dmode: opts.dmode,
    fmode: opts.fmode,
    umask: opts.umask,

    gid: opts.gid,
    uid: opts.uid,

    ignore: function (name, header) {
      return _ignore(name, header, sawIgnores, opts.logger)
    },
    verifier: function (path, digest, cb) {
      return _verify(path, digest, opts.digest, cb)
    }
  }, function (err, digest) {
    if (err) { return cb(err) }
    register(cache, registry, spec, digest, function (err) {
      if (err) {
        return cacache.clear.entry(cache, digest, function (err2) {
          cb(err2 || err)
        })
      }
      cb(null)
    })
  })
}

function _ignore (name, header, sawIgnores, logger) {
  if (header.type.match(/^.*Link$/)) {
    if (logger) {
      logger.warn('excluding symbolic link',
      header.path + ' -> ' + header.linkname)
    }
    return true
  }

  // Note: This mirrors logic in the fs read operations that are
  // employed during tarball creation, in the fstream-npm module.
  // It is duplicated here to handle tarballs that are created
  // using other means, such as system tar or git archive.
  if (header.type === 'File') {
    var base = path.basename(header.path)
    if (base === '.npmignore') {
      sawIgnores[header.path] = true
    } else if (base === '.gitignore') {
      var npmignore = header.path.replace(/\.gitignore$/, '.npmignore')
      if (sawIgnores[npmignore]) {
        // Skip this one, already seen.
        return true
      } else {
        // Rename, may be clobbered later.
        header.path = npmignore
        header._path = npmignore
      }
    }
  }

  return false
}

function _verify (path, digest, expected, name, version, cb) {
  var j = path.resolve(path, 'package.json')
  readJson(j, function (err, d) {
    if (!err) {
      if (expected && (expected !== digest)) {
        err = new Error('invalid digest')
        err.expected = expected
        err.found = digest
        err.code = 'EBADDIGEST'
      }
    }
    if (err) { return cb(err) }
    cb()
  })
}
