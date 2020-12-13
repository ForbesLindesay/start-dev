# @start-dev/rewrite-imports

A very fast utility for rewriting ES Modules import paths. This uses a Web Assembly library that lexes (but does not fully parse) the JavaScript to find thee locations of imports, making it **much** faster than applying a similar transformation using babel or similar.
