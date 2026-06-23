import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * CryptoService — integridad e inmutabilidad de la traza de auditoría.
 *
 * Dos garantías criptográficas exigidas por la Superintendencia (MVP 4):
 *
 *  1) CADENA DE HASHES (estilo blockchain): cada registro encadena el hash del
 *     anterior (prev_hash). Alterar un registro pasado rompe la cadena de todos
 *     los registros posteriores → manipulación detectable.
 *
 *  2) FIRMA DIGITAL: cada decisión se firma con la clave privada del sistema
 *     (RSA-SHA256). El regulador verifica la firma con la clave pública sin
 *     poder falsificarla.
 */
@Injectable()
export class CryptoService {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;

  constructor() {
    this.loadOrGenerateKeys();
  }

  /**
   * Carga la clave de firma desde SIGNING_KEY_PATH si existe; si no, genera un
   * par RSA efímero (válido para demo/hackatón). En producción la clave privada
   * vive en un HSM y nunca se genera al vuelo.
   */
  private loadOrGenerateKeys(): void {
    const keyPath = process.env.SIGNING_KEY_PATH;
    if (keyPath && fs.existsSync(keyPath)) {
      const pem = fs.readFileSync(keyPath, 'utf8');
      this.privateKey = crypto.createPrivateKey(pem);
      this.publicKey = crypto.createPublicKey(this.privateKey);
      return;
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /** SHA-256 determinista del registro (encadena prev_hash + decisión). */
  hashRecord(prevHash: string, decision: unknown): string {
    const canonical = this.canonicalize({ prevHash, decision });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /** Firma RSA-SHA256 del hash del registro → firma digital del sistema. */
  sign(hash: string): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(hash);
    signer.end();
    return signer.sign(this.privateKey, 'base64');
  }

  /** Verifica que la firma corresponde al hash con la clave pública del sistema. */
  verifySignature(hash: string, signature: string): boolean {
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(hash);
      verifier.end();
      return verifier.verify(this.publicKey, signature, 'base64');
    } catch {
      return false;
    }
  }

  /** Clave pública en PEM para que el regulador verifique las firmas. */
  getPublicKeyPem(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }

  /**
   * Serialización canónica (claves ordenadas) para que el hash sea estable
   * sin importar el orden en que llegan las propiedades del JSON.
   */
  private canonicalize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map((v) => this.canonicalize(v)).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + this.canonicalize(obj[k]))
        .join(',') +
      '}'
    );
  }
}
