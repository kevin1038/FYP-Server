import React from 'react';
import ReactDOM from 'react-dom';

function tick() {
	const element = (
		<div>
		<h2>{new Date().toLocaleTimeString()}</h2>
		</div>
		);
	ReactDOM.render(element, document.getElementById('root'));
}

setInterval(tick, 1000);