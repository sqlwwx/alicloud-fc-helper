const fs = require('fs').promises
const assert = require('assert')
const path = require('path')
const yaml = require('js-yaml')
const merge = require('lodash/merge')

const debug = require('debug')('alicloud-fun-helper')

const writeYml = async (baseDir, name, json) => {
  const ymlPath = path.join(baseDir, name)
  const ymlContent = yaml.dump(json)
  debug(ymlPath, '\n' + ymlContent)
  return fs.writeFile(ymlPath, ymlContent)
}

const buildFunConfig = async (funDir) => {
  assert(funDir, 'required funDir')
  debug('funDir', funDir)
  let pkg = require(path.join(funDir, 'package.json'))
  try {
    if (!pkg.alicloudFunService) {
      pkg = merge({}, require(path.join(funDir, '..', 'package.json')), pkg)
    }
  } catch (err) {
    console.warn(err)
  }
  const { alicloudFunNas, alicloudFun, alicloudFunService, serviceName } = pkg
  assert(alicloudFunService, 'required alicloudFunService')
  assert(alicloudFun, 'required alicloudFun')
  if (alicloudFunNas) {
    await writeYml(funDir, '.nas.yml', alicloudFunNas)
  }
  await writeYml(funDir, 'template.yml', {
    ROSTemplateFormatVersion: '2015-09-01',
    Transform: 'Aliyun::Serverless-2018-04-03',
    Resources: {
      [serviceName]: {
        ...alicloudFunService, ...alicloudFun
      }
    }
  })
}

const buildConfig = async (funsDir) => {
  debug('funsDir', funsDir)
  const files = await fs.readdir(funsDir)
  return Promise.all(files.map(async fileName => {
    if (fileName[0] === '.' || fileName === 'node_modules') {
      return
    }
    const filePath = path.join(funsDir, fileName)
    const stats = await fs.stat(filePath)
    if (!stats.isDirectory()) {
      return
    }
    return buildFunConfig(filePath)
  }))
}

module.exports = buildConfig

if (require.main === module) {
  assert(process.argv[2], 'required funsDir')
  buildConfig(path.resolve(process.argv[2]))
}
