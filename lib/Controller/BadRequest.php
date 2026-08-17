<?php

namespace ChoreChart\Controller;

class BadRequest extends HttpException
{
    public function __construct(string $message = 'Bad request')
    {
        parent::__construct($message, 400);
    }
}
