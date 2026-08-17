<?php

namespace ChoreChart\Controller;

class NotFound extends HttpException
{
    public function __construct(string $message = 'Not found')
    {
        parent::__construct($message, 404);
    }
}
