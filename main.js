#!/usr/bin/env node

import * as htmlparser2 from 'htmlparser2'
import {Readable} from 'node:stream'
import {parseArgs} from 'node:util'
import {URL} from 'node:url'

const randomId = () => globalThis.crypto.randomUUID()

const {positionals: [input]} = parseArgs({allowPositionals: true})
if (!URL.canParse(input)) {
  throw new Error('your input is broken. please feed me a url')
}

const main = async input => {
  let inTag = undefined
  const texts = new Map()
  const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
          const {id = randomId(), type} = attributes
          if (name === "script" && type === "application/ld+json") {
            inTag = id
            texts.set(id, [])
          }
      },
      ontext(text) {
        if (inTag) texts.get(inTag).push(text)
      },
      onclosetag(name) {
          if (name === "script" && inTag) {
            const value = texts.get(inTag)
            try {
              const json = JSON.parse(value.join(''))
              const ary = Array.isArray(json) ? json : [json]
              const recipe = ary.find (o => o['@type']?.includes('Recipe'))
              if (recipe) console.log(JSON.stringify(recipe))
            } catch (e) {
              console.error(e)
            }
            texts.delete(inTag)
            inTag = undefined
          }
      }
  })

  const source = await fetch(input)
  const sourceStream = Readable.fromWeb(source.body)
  sourceStream.on('data', chunk => {
    parser.write(chunk.toString())
  })

  return new Promise((res, rej) => {
    sourceStream.on('error', rej)
    sourceStream.on('end', () => {
      parser.end()
      res()
    })
  })
}

await main(input)
