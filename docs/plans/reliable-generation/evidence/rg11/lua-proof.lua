-- Stand-in for a single atomic script invocation: deterministic clock and command semantics.
-- JSON decoding is a lookup of explicit envelopes created by put(), not a cjson implementation.
local now = 1700000000000
local values, logs, expiry, records = {}, {}, {}, {}
local commands, assertions = 0, 0
local function check(condition, what)
  assertions = assertions + 1
  assert(condition, what)
end
local function expire(key)
  if expiry[key] and expiry[key] <= now then
    values[key], logs[key], expiry[key] = nil, nil, nil
  end
end
redis = {
  error_reply = function(message) return {error = message} end,
  call = function(command, key, ...)
    commands = commands + 1
    if command == 'TIME' then return {tostring(math.floor(now / 1000)), tostring((now % 1000) * 1000)} end
    expire(key)
    local a = {...}
    if command == 'GET' then return values[key] end
    if command == 'SET' then
      assert(a[2] == 'PXAT', 'absolute expiry required')
      values[key], expiry[key] = a[1], tonumber(a[3])
      return 'OK'
    end
    if command == 'ZREMRANGEBYSCORE' then
      assert(a[1] == '-inf')
      for member, score in pairs(logs[key] or {}) do
        if score <= a[2] then logs[key][member] = nil end
      end
      return 0
    end
    if command == 'ZCARD' then local n = 0; for _ in pairs(logs[key] or {}) do n = n + 1 end; return n end
    if command == 'ZADD' then logs[key] = logs[key] or {}; logs[key][a[2]] = a[1]; return 1 end
    if command == 'PEXPIREAT' then expiry[key] = tonumber(a[1]); return 1 end
    if command == 'ZRANGE' then
      assert(a[1] == 0 and a[2] == 0 and a[3] == 'WITHSCORES')
      local first, score
      for member, s in pairs(logs[key] or {}) do if not score or s < score then first, score = member, s end end
      return {first, tostring(score)}
    end
    error('Unexpected Redis command ' .. command)
  end,
}
cjson = {decode = function(encoded) assert(records[encoded], 'Malformed JSON'); return records[encoded] end}
local admission = assert(loadstring(ADMIT_WINDOW))
local fill = assert(loadstring(SET_IF_NEWER))
local function admit(key, limit, window, id)
  KEYS, ARGV = {key}, {tostring(window), tostring(limit), id}
  return admission()
end
local function put(key, version, untilAt, value)
  value = value or 'payload'
  local encoded = string.format('{"v":1,"version":"%s","validUntil":%.0f,"value":"%s"}', version, untilAt, value)
  records[encoded] = {v = 1, version = version, validUntil = untilAt, value = value}
  KEYS, ARGV = {key}, {encoded, version, string.format('%.0f', untilAt), value}
  return fill()
end
local start = now
for i = 1, 20 do
  local result = admit('window', 3, 1000, 'client-' .. i)
  check(result[1] == (i <= 3 and 1 or 0), 'three admissions across callers')
  check(result[2] == math.min(i, 3) and result[4] == start + 1000, 'bounded count and reset')
end
check(expiry.window == start + 1000, 'denials leave absolute expiry unchanged')
now = start + 999
check(admit('window', 3, 1000, 'late')[1] == 0, 'last millisecond remains denied')
check(expiry.window == start + 1000, 'late denial does not renew expiry')
now = start + 1000
check(admit('window', 3, 1000, 'new-window')[1] == 1, 'exact expiry begins new admission')
check(expiry.window == start + 2000, 'new expiry uses server time')
-- Sliding, not a fixed bucket: the oldest entry expires before the next entry.
now = start + 3000
check(admit('rolling', 2, 1000, 'a')[1] == 1, 'first rolling entry')
now = start + 3400
check(admit('rolling', 2, 1000, 'b')[1] == 1, 'second rolling entry')
now = start + 4000
local rolling = admit('rolling', 2, 1000, 'c')
check(rolling[1] == 1 and rolling[2] == 2 and rolling[4] == start + 4400, 'inclusive oldest removal')
check(admit('rolling', 2, 1000, 'd')[1] == 0, 'remaining window still full')
-- Exact ordering around JS/Lua number precision and uint64 upper bound.
local bound = now + 1000
check(put('item', '9007199254740993', bound) == 1, 'large version stored')
local original = values.item
check(put('item', '9007199254740992', bound + 100) == 0, 'adjacent older version rejected')
check(values.item == original and expiry.item == bound, 'older fill changes neither value nor expiry')
check(put('item', '9007199254740994', bound - 100) == 1, 'newer version can shorten absolute validity')
check(put('item', '9007199254740994', bound + 100, 'changed') == 3, 'same-version content conflict')
check(put('item', '9007199254740994', bound - 200) == 0, 'same-version older validity rejected')
check(put('item', '9007199254740994', bound + 100) == 1, 'same-version identical content can refresh')
check(put('item', '18446744073709551615', bound + 200) == 1, 'maximum uint64')
check(put('item', '9999999999999999999', bound + 300) == 0, 'length first ordering')
-- Absolute expiry is computed before network delivery, never relative to arrival at the store.
local absolute = now + 50
now = now + 25
check(put('delay', '1', absolute) == 1 and expiry.delay == absolute, 'delayed fill keeps original bound')
now = absolute
local before = commands
check(put('delay', '2', absolute) == 2, 'expired fill rejected')
check(commands == before + 1, 'expired fill performs TIME only')
expire('delay'); check(values.delay == nil, 'value expires exactly at absolute bound')
check(put('future', '1', now + 604800001).error == 'JEEVES_CACHE_EXPIRY', 'excessive horizon refused')
check(values.future == nil, 'bad horizon never stores')
values.corrupt = 'not-json'
check(put('corrupt', '1', now + 1000).error == 'JEEVES_CACHE_RECORD', 'unreadable current record refuses overwrite')
check(values.corrupt == 'not-json', 'corrupt record preserved')
print(string.format('Actual emitted Lua 5.1 scripts: %d independent assertions passed; %d stand-in Redis commands.', assertions, commands))
print('Limits: deterministic Redis/TIME/cjson doubles; no native Valkey, transport, competing processes or eviction/durability proof.')
