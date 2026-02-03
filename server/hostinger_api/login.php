<?php
header('Content-Type: application/json; charset=utf-8');

$config = __DIR__ . '/config.php';
if (!file_exists($config)) {
  // try sample
  $sample = __DIR__ . '/config.sample.php';
  if (file_exists($sample)) {
    $c = include $sample;
  } else {
    http_response_code(500);
    echo json_encode(['message' => 'Config missing']);
    exit;
  }
} else {
  $c = include $config;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = $input['email'] ?? '';
$password = $input['password'] ?? '';

if (!$email || !$password) {
  http_response_code(400);
  echo json_encode(['message' => 'Email et mot de passe requis']);
  exit;
}

$mysqli = new mysqli($c['DB_HOST'], $c['DB_USER'], $c['DB_PASS'], $c['DB_NAME'], $c['DB_PORT'] ?? 3306);
if ($mysqli->connect_errno) {
  http_response_code(500);
  echo json_encode(['message' => 'DB connection failed', 'error' => $mysqli->connect_error]);
  exit;
}

// For simplicity assumes passwords stored in plain text — replace with hashed verification in production
$stmt = $mysqli->prepare('SELECT id, email, type FROM users WHERE email = ? AND password = ? LIMIT 1');
if (!$stmt) {
  http_response_code(500);
  echo json_encode(['message' => 'Query prepare failed']);
  exit;
}
$stmt->bind_param('ss', $email, $password);
$stmt->execute();
$res = $stmt->get_result();
if ($row = $res->fetch_assoc()) {
  if ($row['type'] !== 'employe') {
    http_response_code(403);
    echo json_encode(['message' => 'Accès refusé : utilisateur non autorisé']);
  } else {
    echo json_encode(['ok' => true, 'user' => $row]);
  }
} else {
  http_response_code(401);
  echo json_encode(['message' => 'Identifiants invalides']);
}
$stmt->close();
$mysqli->close();
