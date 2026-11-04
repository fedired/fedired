import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress } from "./ssrf-guard.js";

test("bloquea IPv4 de loopback, privadas, link-local y reservadas", () => {
	const blocked = [
		"0.0.0.0",
		"10.1.2.3",
		"100.64.0.1",
		"127.0.0.1",
		"169.254.169.254",
		"172.16.0.1",
		"172.31.255.255",
		"192.168.1.1",
		"198.18.0.1",
		"224.0.0.1",
		"240.0.0.1",
		"255.255.255.255",
	];
	for (const ip of blocked) {
		assert.equal(isPublicAddress(ip), false, `debería bloquear ${ip}`);
	}
});

test("bloquea IPv6 de loopback, ULA, link-local, multicast y Teredo/6to4", () => {
	const blocked = [
		"::",
		"::1",
		"fe80::1",
		"fc00::1",
		"fd12:3456::1",
		"ff02::1",
		"2001::1",
		"2001:db8::1",
		"2002::1",
	];
	for (const ip of blocked) {
		assert.equal(isPublicAddress(ip), false, `debería bloquear ${ip}`);
	}
});

test("bloquea IPv4 embebida en IPv6 cuando la IPv4 es privada", () => {
	const blocked = [
		"::ffff:127.0.0.1",
		"::ffff:10.0.0.1",
		"::ffff:169.254.169.254",
		"64:ff9b::7f00:1",
		"[::1]",
	];
	for (const ip of blocked) {
		assert.equal(isPublicAddress(ip), false, `debería bloquear ${ip}`);
	}
});

test("permite direcciones públicas, incluidas IPv4 públicas embebidas", () => {
	const allowed = [
		"93.184.216.34",
		"8.8.8.8",
		"::ffff:93.184.216.34",
		"64:ff9b::5db8:d822",
		"2606:2800:220:1:248:1893:25c8:1946",
	];
	for (const ip of allowed) {
		assert.equal(isPublicAddress(ip), true, `debería permitir ${ip}`);
	}
});

test("no trata hostnames sin resolver como direcciones públicas", () => {
	assert.equal(isPublicAddress("example.com"), false);
	assert.equal(isPublicAddress(""), false);
});

test("allowedPrivateNetworks permite solo los rangos configurados", () => {
	assert.equal(isPublicAddress("10.20.0.5", ["10.0.0.0/8"]), true);
	assert.equal(isPublicAddress("127.0.0.1", ["10.0.0.0/8"]), false);
	assert.equal(isPublicAddress("fd00::5", ["fd00::/8"]), true);
	assert.equal(isPublicAddress("fd01::5", ["fd00::/8"]), true);
	assert.equal(isPublicAddress("fe80::5", ["fd00::/8"]), false);
});

test("allowedPrivateNetworks ignora entradas inválidas (lado seguro)", () => {
	assert.equal(isPublicAddress("10.20.0.5", ["no-es-una-red"]), false);
});
