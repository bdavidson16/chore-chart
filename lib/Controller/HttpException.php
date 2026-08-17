<?php

namespace ChoreChart\Controller;

use RuntimeException;

/** A controller failure the router turns into a JSON error with a status code. */
class HttpException extends RuntimeException
{
    public function __construct(string $message, private int $status = 500)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
