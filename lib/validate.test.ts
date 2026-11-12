import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { charLength, validateSubmission } from './validate'

describe('validateSubmission', () => {
  it('trims the body and treats a blank nickname as null', () => {
    const result = validateSubmission('  现场怎么提问？  ', '   ')
    assert.deepEqual(result, { ok: true, body: '现场怎么提问？', authorName: null })
  })

  it('keeps a nickname within 40 characters', () => {
    const result = validateSubmission('一个问题', ' 小林 ')
    assert.deepEqual(result, { ok: true, body: '一个问题', authorName: '小林' })
  })

  it('rejects an empty body and over-long fields by character', () => {
    assert.equal(validateSubmission('   ', '').ok, false)
    assert.equal(validateSubmission('问'.repeat(201), '').ok, false)
    assert.equal(validateSubmission('问', '名'.repeat(41)).ok, false)
    assert.equal(charLength('问'.repeat(200)), 200)
    assert.equal(validateSubmission('问'.repeat(200), '名'.repeat(40)).ok, true)
  })
})
