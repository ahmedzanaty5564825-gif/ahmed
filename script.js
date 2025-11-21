document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    let currentInput = '';
    let operator = '';
    let firstOperand = null;
    let isErrorState = false;

    function appendInput(value) {
        if (isErrorState) {
            clearDisplay();
        }
        if (value === '.' && currentInput.includes('.')) {
            return;
        }
        currentInput += value;
        updateDisplay();
    }

    function clearDisplay() {
        currentInput = '';
        operator = '';
        firstOperand = null;
        isErrorState = false;
        updateDisplay('0');
    }

    function updateDisplay(value) {
        display.textContent = value !== undefined ? value : currentInput || '0';
    }

    function calculate() {
        if (firstOperand === null || operator === '' || currentInput === '') {
            return;
        }

        const secondOperand = parseFloat(currentInput);
        let result;

        switch (operator) {
            case '+':
                result = firstOperand + secondOperand;
                break;
            case '-':
                result = firstOperand - secondOperand;
                break;
            case '*':
                result = firstOperand * secondOperand;
                break;
            case '/':
                if (secondOperand === 0) {
                    updateDisplay('خطأ');
                    isErrorState = true;
                    return;
                }
                result = firstOperand / secondOperand;
                break;
            default:
                return;
        }
        
        result = parseFloat(result.toPrecision(12));

        currentInput = result.toString();
        operator = '';
        firstOperand = null;
        updateDisplay();
    }

    function setOperator(op) {
        if (currentInput === '' || isErrorState) {
            return;
        }
        if (firstOperand !== null) {
            calculate();
        }
        if (isErrorState) {
            return;
        }
        firstOperand = parseFloat(currentInput);
        operator = op;
        currentInput = '';
    }

    // Add event listeners to buttons
    const buttons = document.querySelector('.buttons');
    buttons.addEventListener('click', (event) => {
        if (!event.target.matches('button')) {
            return;
        }

        const button = event.target;
        const value = button.textContent;

        if (button.classList.contains('operator')) {
            if (value === 'C') {
                clearDisplay();
            } else {
                setOperator(value);
            }
        } else if (button.classList.contains('equal')) {
            calculate();
        } else {
            appendInput(value);
        }
    });
});