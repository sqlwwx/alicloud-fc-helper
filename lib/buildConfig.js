const fs = require('fs').promises
const assert = require('assert')
const path = require('path')
const yaml = require('js-yaml')
const merge = require('lodash/merge')

const debug = require('debug')('alicloud-fc-helper')

const writeYml = async (baseDir, name, json) => {
  const ymlPath = path.join(baseDir, name)
  const ymlContent = yaml.dump(json)
  debug(ymlPath, '\n' + ymlContent)
  return fs.writeFile(ymlPath, ymlContent)
}

const buildFcConfig = async (fcDir) => {
  assert(fcDir, 'required fcDir')
  debug('fcDir', fcDir)
  let pkg
  try {
    pkg = require(path.join(fcDir, 'package.json'))
    if (!pkg.alicloudFcService) {
      pkg = merge({}, require(path.join(fcDir, '..', 'package.json')), pkg)
    }
  } catch (err) {
    console.warn(err)
  }
  if (!pkg) {
    console.log('skip', fcDir)
    return
  }
  const { alicloudFcNas, alicloudFc, alicloudFcService, serviceName } = pkg
  assert(alicloudFcService, 'required alicloudFcService')
  assert(alicloudFc, 'required alicloudFc')
  if (alicloudFcNas) {
    await writeYml(fcDir, '.nas.yml', alicloudFcNas)
  }
  await writeYml(fcDir, 'template.yml', {
    ROSTemplateFormatVersion: '2015-09-01',
    Transform: 'Aliyun::Serverless-2018-04-03',
    Resources: {
      [serviceName]: {
        ...alicloudFcService, ...alicloudFc
      }
    }
  })
}

const buildConfig = async (fcsDir) => {
  debug('fcsDir', fcsDir)
  const files = await fs.readdir(fcsDir)
  return Promise.all(files.map(async fileName => {
    if (fileName[0] === '.' || fileName === 'node_modules') {
      return
    }
    const filePath = path.join(fcsDir, fileName)
    const stats = await fs.stat(filePath)
    if (!stats.isDirectory()) {
      return
    }
    return buildFcConfig(filePath)
  }))
}

module.exports = buildConfig

if (require.main === module) {
  assert(process.argv[2], 'required fcsDir')
  buildConfig(path.resolve(process.argv[2]))
}
