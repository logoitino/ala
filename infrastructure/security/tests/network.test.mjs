/** Verify source uses IPv4 netmask guards and test canonical-network adversarial cases; Terraform execution is separate operator evidence. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function variable(filename, name) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  const expression = new RegExp(`variable "${name}" \\{([\\s\\S]*?)\\n\\}`, 'm').exec(source)?.[1];
  assert.ok(expression, `Expected bounded variable definition ${name}`);
  return expression;
}

test('both SSH lists reject normalized zero masks using IPv4-only netmask validation', () => {
  for (const provider of ['aws', 'azure']) {
    const source = variable(`infrastructure/terraform/${provider}/variables.tf`, 'admin_ipv4_cidrs');
    assert.match(source, /can\(cidrnetmask\(cidr\)\)/);
    assert.match(source, /try\(cidrnetmask\(cidr\) != "0\.0\.0\.0", false\)/);
    assert.doesNotMatch(source, /cidr != "0\.0\.0\.0\/0"/);
  }
});

test('Azure backup rules use the same zero-mask guard and accept bare IPv4 through netmask validation', () => {
  const source = variable('infrastructure/terraform/azure/variables.tf', 'backup_ipv4_ranges');
  assert.match(source, /can\(cidrnetmask\(cidr\)\)/);
  assert.match(source, /try\(cidrnetmask\(cidr\) != "0\.0\.0\.0", false\)/);
  assert.ok(source.includes('can(cidrnetmask("${cidr}/32"))'));
  assert.doesNotMatch(source, /cidrhost\(/);
});

test('independent IPv4 canonical-network reference rejects host-bit wildcard variants and all IPv6', () => {
  const cases = [
    ['0.0.0.0/0', false, false], ['10.0.0.1/0', false, false], ['128.0.0.0/0', false, false],
    ['255.255.255.255/0', false, false], ['203.0.113.9/32', true, true],
    ['203.0.113.17/24', true, true], ['192.0.2.0/28', true, true],
    ['203.0.113.9', false, true], ['::/0', false, false], ['::1', false, false],
    ['2001:db8::/32', false, false], ['::ffff:203.0.113.9', false, false],
    ['', false, false], ['not-a-network', false, false], ['203.0.113.1/33', false, false],
  ];
  const script = `import ipaddress,json,sys
def allowed(value,bare):
    try:
        if '/' not in value:
            return bare and isinstance(ipaddress.ip_address(value),ipaddress.IPv4Address)
        network=ipaddress.ip_network(value,strict=False)
        return isinstance(network,ipaddress.IPv4Network) and str(network.netmask) != '0.0.0.0'
    except ValueError:
        return False
cases=json.load(sys.stdin)
print(json.dumps([[value,allowed(value,False),allowed(value,True)] for value,_,_ in cases]))
`;
  const observed = JSON.parse(execFileSync('python3', ['-c', script], { input: JSON.stringify(cases), encoding: 'utf8' }));
  assert.deepEqual(observed, cases);
});
