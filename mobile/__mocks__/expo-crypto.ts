/**
 * Jest auto-mock for expo-crypto. The real module is a Hermes/JSI bridge
 * that returns undefined under jest-expo's default native-module shim;
 * we delegate to node's crypto.randomUUID so lib/id.uuid() yields real
 * UUIDs in tests.
 */
import { randomUUID } from 'crypto';

export { randomUUID };
