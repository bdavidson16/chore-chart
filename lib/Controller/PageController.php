<?php

namespace ChoreChart\Controller;

use OCA\ChoreTracker\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;

/**
 * Serves the app shell under Nextcloud: templates/main.php mounts the built
 * React bundle. Only Nextcloud loads this — in local development Vite serves
 * index.html and api/index.php serves the API.
 */
class PageController extends Controller
{
    public function __construct(IRequest $request)
    {
        parent::__construct(Application::APP_ID, $request);
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): TemplateResponse
    {
        return new TemplateResponse(Application::APP_ID, 'main');
    }
}
