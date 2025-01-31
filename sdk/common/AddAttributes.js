/* 
 * Copyright 2018 Ionic Security Inc.
 * By using this code, I agree to the Terms & Conditions (https://dev.ionic.com/use.html)
 * and the Privacy Policy (https://www.ionic.com/privacy-notice/).
 */

/**
 * Common module.
 * @module common/add-attributes
 */

var crypto = require('../../internal-modules/crypto-abstract.js');
var generateCid = require('./GenerateCID.js');

const {ERRCODE, ERRMSG, STRINGS } = require('../constants.js');
const { customErrorResponse } = require('./CustomErrorResponse.js');

module.exports = { addAttributes, addMutableAttributes};

/**
 * @param {Object} keyAttributes Key attributes object.
 * @param {String} keyRef Key request reference string.
 * @param {Object} sep Secure enrollment profile object.
 * @param {BufferSource} nonce Initialization vector generated by RandomSource.getRandomValues().
 * @param {String} cid Conversation ID.
 *
 * @returns {Promise<AttributeSigningResponse>} Promise that resolves with a response object.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt|SubtleCrypto.encrypt} spec
 */
function addMutableAttributes (keyAttributes, keyRef, sep, nonce, cid) {
  return addAttributes(keyAttributes, STRINGS.MUTABLE_PREFIX+keyRef, sep, nonce, cid);
}

/**
 * @param {Object} objKeyAttributes Key attributes object.
 * @param {String} strKeyRef Key request reference string.
 * @param {Object} objSEP Secure enrollment profile object.
 * @param {BufferSource} nonce Initialization vector generated by RandomSource.getRandomValues().
 * @param {String} cid Conversation ID.
 *
 * @returns {Promise<AttributeSigningResponse>} Promise that resolves with a response object.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt|SubtleCrypto.encrypt} spec
 */
function addAttributes (objKeyAttributes, strKeyRef, objSEP, nonce, cid) {
    let kaAesKey;
    let encryptionIVs;
    let attrsString;
    return Promise.resolve()
        .then(() => {
            if (!objKeyAttributes) {
                objKeyAttributes = {};
            }
            
            if(objKeyAttributes.constructor != Object){
                throw "Invalid attributes format";
            }
            // Import the Key Appliance AES-Key from the SEP.
            return crypto.importKey({
                type: 'raw',
                key: Buffer.from(objSEP.ka_aes_key, 'hex'),
                algorithm: 'AES-GCM',
                extractable: false,
                usages: ['encrypt', 'decrypt']
            });
        })

        .then(aesKey => {
            kaAesKey = aesKey;

            let arrIVPromise = [];

            // Create the initialization vectors for each array of attributes.
            for(let key in objKeyAttributes){
                if(key.startsWith('ionic-protected-') || key === 'ionic-integrity-hash'){
                    arrIVPromise.push(crypto.getRandomValues(16));
                }
            }

            return Promise.all(arrIVPromise);
        })

        .then(arrIVs => {
            encryptionIVs = arrIVs;

            // Encrypt the attributes.
            let arrEncryptPromises = [];
            let i = 0;
            for(let key in objKeyAttributes){
                if(key.startsWith('ionic-protected-') || key === 'ionic-integrity-hash'){
                    arrEncryptPromises.push(crypto.encrypt({
                        key: kaAesKey,
                        iv: arrIVs[i],
                        data: Buffer.from(JSON.stringify(objKeyAttributes[key])),
                        algorithm: 'AES-GCM',
                        additionalData: Buffer.from(key)
                    }));
                    i++;
                }
            }
            return Promise.all(arrEncryptPromises);
        })

        .then(arrCipher => {
        // Prepare the required attributes. Each attribute contains a name and a list of values.
            let objAttrs = {};

            let i = 0;
            for(let key in objKeyAttributes){
                if(key.startsWith('ionic-protected-') || key === 'ionic-integrity-hash'){
                    // set encrypted attributes
                    objAttrs[key] = [Buffer.concat([encryptionIVs[i], arrCipher[i]]).toString('base64')];
                    i++;
                }
                else{
                    // send plaintext attributes
                    objAttrs[key] = objKeyAttributes[key];
                }
            }
            
            attrsString = objAttrs ? JSON.stringify(objAttrs) : '';
            // Compute the SHA256 hash of those bytes.
            return crypto.digest({
                algorithm: 'SHA-256',
                data: Buffer.from(attrsString)
            });
        })
        .then(hash => {
            // Encrypt the attribute hash bytes using KA AES key 
            // and the pregenerated nonce 16-byte initialization vector.
            return crypto.encrypt({
                key: kaAesKey,
                data: Buffer.from(hash, 'hex'),
                algorithm: 'AES-GCM',
                iv: nonce,
                additionalData: Buffer.from([cid, strKeyRef].join(':'))
            });
        })

        .then(cipher => {
            let objOut = {
                sig: Buffer.concat([nonce, cipher]).toString('base64'),
                attrs: attrsString
            };
            return Promise.resolve(objOut);
        })

        .catch(err => {
            console.error("Unexpected error occurred while building signed attributes object");
            return customErrorResponse(err, ERRMSG.UNKNOWN, ERRCODE.UNKNOWN);
        });
}

////////////////////////////////////////////
// JSDoc custom types
// see http://usejsdoc.org/tags-typedef.html
//
// Defines objects that are passed into or
// returned by multiple functions
////////////////////////////////////////////
/**
 * Response object for an attribute signing operation.
 * Contains the attribute string (JSON) and the base64-encoded signature string. 
 * @typedef {Object} AttributeSigningResponse
 * @property {String} attrs Attributes specified as a JSON string.
 * @property {String} sig Base64-encoded encrypted data (IV concatenated with the cipher), 
 * encoded into the specified 
 * {@link https://dev.ionic.com/fundamentals/data-format/chunkdataformat.html|Chunk format}.
 * @property {String} error - Specifies the SDK error message (if applicable).
 */
