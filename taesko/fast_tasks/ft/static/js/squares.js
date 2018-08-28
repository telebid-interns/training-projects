function generateSudokuGrid($grid, $squareTempl, $cellTempl, squareSideLength) {
    $grid.find('*:not(#sudoku-cell)').remove();
    $grid.find('*:not(#sudoku-square)').remove();

    const squareCount = squareSideLength * squareSideLength;

    for (let squareIndex = 0; squareIndex < squareCount; squareIndex++) {
        const $square = $squareTempl.clone()
            .removeAttr('id');
        for (let cellIndex = 0; cellIndex < squareCount; cellIndex++) {
            const absoluteIndex = squareIndex * squareCount;
            const row = Math.floor(absoluteIndex / squareCount) + Math.floor(cellIndex / squareCount);
            const col = absoluteIndex % squareCount + cellIndex % squareCount;
            const $cell = $cellTempl.clone()
                .attr('id', `cell-${row}-${col}`);

            $square.append($cell);
        }
        $grid.append($square);
    }
}


$(document).ready(() => {
    const $squareLengthInput = $('#small-square-length');
    const $grid = $('#sudoku-grid');
    const $square = $('#sudoku-square');
    const $cell = $('#sudoku-cell');

    $squareLengthInput.change(() => {
        const length = $squareLengthInput.val();

        console.info('Square length input changed to', length);
        generateSudokuGrid($grid, $square, $cell, length);
    })
});