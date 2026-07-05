public function create(\OC\App\Request\Simple as $request): ?string
{
    $file = \OC::$server->getRootFolder()->newFile('chores.md');
    $data = [
        'title' => $request->param('title'),
        'assigned_to' => $request->param('assigned_to'),
        'done' => false,
        'due_date' => $request->param('due_date'),
    ];
    $file->write(json_encode($data));
    return $file->getURL();
}

public function getChore(\OC\App\Request\Simple as $request): ?array
{
    $id = $request->param('id');
    $file = \OC::$server->getRootFolder()->newFile('chores.md');
    $content = $file->read();
    $chores = json_decode($content, true); // Decode as associative array
    if ($chores && isset($chores[$id])) {
        return $chores[$id];
    }
    return null;
}